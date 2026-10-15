package com.shopademia.admin.data

import com.shopademia.admin.data.api.AdminApiFactory
import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.domain.ApiErrorMapper
import com.shopademia.admin.domain.AppError
import java.io.IOException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class ApiAdminRepositoryTest {
    private lateinit var server: MockWebServer
    private lateinit var tokens: MemoryTokenStore
    private lateinit var repository: ApiAdminRepository

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
        tokens = MemoryTokenStore()
        repository = ApiAdminRepository(
            AdminApiFactory.create(server.url("/api/v1/").toString(), tokens),
            tokens
        )
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    @Test
    fun loginUsesNativeBearerContractAndDoesNotPersistBrowserCookies() = kotlinx.coroutines.runBlocking {
        server.enqueue(
            MockResponse()
                .setHeader("Set-Cookie", "admin_session=browser-cookie; HttpOnly; SameSite=Strict")
                .setBody("""{"token":"native-test-token","expiresIn":28800}""")
        )
        server.enqueue(MockResponse().setBody("""{"data":{"email":"owner@example.test","shopId":"shop-1","role":"owner","isPlatformAdmin":false}}"""))

        val result = repository.signIn(" owner@example.test ", "correct horse", null)

        assertTrue(result is LoginOutcome.Authenticated)
        assertEquals("native-test-token", tokens.value)
        val login = server.takeRequest()
        assertEquals("POST", login.method)
        assertEquals("/api/v1/admin/login", login.path)
        assertNull(login.getHeader("Origin"))
        assertNull(login.getHeader("Authorization"))
        assertFalse(login.getHeader("Cookie")?.contains("browser-cookie") == true)
        assertEquals(
            "owner@example.test",
            com.google.gson.JsonParser.parseString(login.body.readUtf8()).asJsonObject["email"].asString
        )

        val profile = server.takeRequest()
        assertEquals("Bearer native-test-token", profile.getHeader("Authorization"))
        assertNull(profile.getHeader("Cookie"))
    }

    @Test
    fun logoutClearsPersistedTokenOnlyAfterServerRevocation() = kotlinx.coroutines.runBlocking {
        tokens.value = "active-token"
        server.enqueue(MockResponse().setResponseCode(204))

        repository.signOut()

        assertNull(tokens.value)
        val logout = server.takeRequest()
        assertEquals("POST", logout.method)
        assertEquals("/api/v1/admin/logout", logout.path)
        assertEquals("Bearer active-token", logout.getHeader("Authorization"))
    }

    @Test
    fun failedLogoutKeepsTokenForRetry() = kotlinx.coroutines.runBlocking {
        tokens.value = "active-token"
        server.enqueue(MockResponse().setResponseCode(503).setBody("""{"error":"Temporarily unavailable."}"""))

        try {
            repository.signOut()
            throw AssertionError("Expected server failure.")
        } catch (_: HttpException) {
            assertEquals("active-token", tokens.value)
        }
    }

    @Test
    fun unauthorizedLogoutClearsAlreadyInvalidSession() = kotlinx.coroutines.runBlocking {
        tokens.value = "expired-token"
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired."}"""))

        repository.signOut()

        assertNull(tokens.value)
    }

    @Test
    fun productPageUsesBoundedDocumentedPaginationParameters() = kotlinx.coroutines.runBlocking {
        tokens.value = "active-token"
        server.enqueue(
            MockResponse().setBody(
                """{"data":[],"pagination":{"limit":20,"offset":40,"total":40,"hasMore":false}}"""
            )
        )

        val result = repository.products(20, 40)

        assertEquals(40, result.pagination.offset)
        val request = server.takeRequest()
        assertEquals("/api/v1/admin/products?limit=20&offset=40", request.path)
        assertEquals("Bearer active-token", request.getHeader("Authorization"))
    }

    @Test
    fun platformMfaEnrollmentUsesSetupTokenAndStoresOnlyTheIssuedBearerSession() = kotlinx.coroutines.runBlocking {
        server.enqueue(
            MockResponse().setBody(
                """{"mfaSetupRequired":true,"setupToken":"synthetic-setup-token","totpSecret":"synthetic-secret","provisioningUri":"otpauth://test"}"""
            )
        )
        server.enqueue(MockResponse().setBody("""{"token":"native-test-token","expiresIn":28800}"""))
        server.enqueue(MockResponse().setBody("""{"data":{"email":"platform@example.test","shopId":null,"role":null,"isPlatformAdmin":true}}"""))

        val login = repository.signIn("platform@example.test", "password", null)
        assertTrue(login is LoginOutcome.MfaEnrollmentRequired)
        assertNull(tokens.value)
        val profile = repository.enrollMfa("synthetic-setup-token", "123456")
        assertTrue(profile.isPlatformAdmin)
        assertEquals("native-test-token", tokens.value)

        val initialRequest = server.takeRequest()
        assertEquals("/api/v1/admin/login", initialRequest.path)
        assertNull(initialRequest.getHeader("Authorization"))
        val enrollmentRequest = server.takeRequest()
        assertEquals("/api/v1/admin/mfa/enroll", enrollmentRequest.path)
        assertNull(enrollmentRequest.getHeader("Authorization"))
        val enrollmentBody = enrollmentRequest.body.readUtf8()
        assertTrue(enrollmentBody.contains("synthetic-setup-token"))
        assertTrue(enrollmentBody.contains("123456"))
        assertTrue(server.takeRequest().getHeader("Authorization")?.startsWith("Bearer ") == true)
    }

    @Test
    fun orderPageUsesTheDocumentedOneBasedPaginationParameters() = kotlinx.coroutines.runBlocking {
        tokens.value = "active-token"
        server.enqueue(MockResponse().setBody("""{"data":[],"page":3,"limit":20,"total":80}"""))

        val result = repository.orders(page = 3, limit = 20, status = null)

        assertEquals(3, result.page)
        assertEquals(80, result.total)
        assertEquals("/api/v1/admin/orders?page=3&limit=20", server.takeRequest().path)
    }

    @Test
    fun apiRequestIdIsRetainedInTheMappedError() = kotlinx.coroutines.runBlocking {
        tokens.value = "active-token"
        server.enqueue(
            MockResponse()
                .setResponseCode(403)
                .setHeader("X-Request-Id", "synthetic-request-id")
                .setBody("""{"error":"Shop access is required."}""")
        )

        try {
            repository.dashboard()
            throw AssertionError("Expected forbidden response.")
        } catch (error: HttpException) {
            val mapped = ApiErrorMapper.from(error)
            assertEquals("synthetic-request-id", mapped.requestId)
            assertTrue(mapped.message.contains("synthetic-request-id"))
        }
    }

    @Test
    fun unauthorizedProfileAfterLoginClearsTheJustIssuedSession() = kotlinx.coroutines.runBlocking {
        server.enqueue(MockResponse().setBody("""{"token":"new-token","expiresIn":28800}"""))
        server.enqueue(MockResponse().setResponseCode(401).setBody("""{"error":"Session expired."}"""))

        try {
            repository.signIn("owner@example.test", "password", null)
            throw AssertionError("Expected expired-session failure.")
        } catch (_: HttpException) {
            assertNull(tokens.value)
        }
    }

    @Test
    fun errorMappingPreservesTypedStatesAndSafeRequestIds() {
        val response = Response.error<AdminProfile>(
            403,
            okhttp3.ResponseBody.create(
                "application/json".toMediaType(),
                """{"error":"Shop access is required."}"""
            )
        )
        val mapped = ApiErrorMapper.from(HttpException(response))
        assertTrue(mapped is AppError.Forbidden)
        assertEquals("Shop access is required.", mapped.message)

        assertTrue(ApiErrorMapper.from(IOException("connection refused")) is AppError.Network)
        assertTrue(ApiErrorMapper.from(IllegalStateException("keystore unavailable")) is AppError.Unexpected)
    }

    @Test
    fun errorMappingSeparatesValidationAuthConflictThrottleAndServerFailure() {
        val errors = listOf(
            400 to AppError.Validation::class.java,
            401 to AppError.Unauthorized::class.java,
            404 to AppError.NotFound::class.java,
            409 to AppError.Conflict::class.java,
            429 to AppError.RateLimited::class.java,
            500 to AppError.Server::class.java
        )
        errors.forEach { (status, expected) ->
            val response = Response.error<AdminProfile>(
                status,
                okhttp3.ResponseBody.create(
                    "application/json".toMediaType(),
                    """{"error":"Safe API error."}"""
                )
            )
            assertTrue("status $status", expected.isInstance(ApiErrorMapper.from(HttpException(response))))
        }
    }

    private class MemoryTokenStore(var value: String? = null) : TokenStore {
        override fun read(): String? = value
        override fun write(token: String) {
            value = token
        }
        override fun clear() {
            value = null
        }
    }
}
