package com.shopademia.admin.data

import com.shopademia.admin.data.api.AdminApi
import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.LoginRequest
import com.shopademia.admin.data.model.MfaEnrollmentRequest
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import retrofit2.HttpException

class ApiAdminRepository(
    private val api: AdminApi,
    private val tokenStore: TokenStore
) : AdminRepository {
    override suspend fun signIn(email: String, password: String, totpCode: String?): LoginOutcome {
        val response = api.login(LoginRequest(email.trim(), password, totpCode?.trim()?.takeIf { it.isNotEmpty() }))
        if (response.mfaSetupRequired == true) {
            return LoginOutcome.MfaEnrollmentRequired(
                setupToken = response.setupToken.required("MFA setup token"),
                secret = response.totpSecret.required("MFA enrollment key"),
                provisioningUri = response.provisioningUri.required("MFA provisioning URI")
            )
        }
        return LoginOutcome.Authenticated(storeSessionAndLoadProfile(response.token.required("Bearer token")))
    }

    override suspend fun enrollMfa(setupToken: String, totpCode: String): AdminProfile {
        val response = api.enrollMfa(MfaEnrollmentRequest(setupToken, totpCode.trim()))
        return storeSessionAndLoadProfile(response.token.required("Bearer token"))
    }

    override suspend fun restoreSession(): AdminProfile? {
        if (withContext(Dispatchers.IO) { tokenStore.read() } == null) return null
        return try {
            api.profile().data
        } catch (error: HttpException) {
            if (error.code() == 401) withContext(Dispatchers.IO) { tokenStore.clear() }
            throw error
        }
    }

    override suspend fun signOut() {
        try {
            api.logout()
        } catch (error: HttpException) {
            if (error.code() != 401) throw error
        }
        withContext(Dispatchers.IO) { tokenStore.clear() }
    }

    override suspend fun clearExpiredSession() {
        withContext(Dispatchers.IO) { tokenStore.clear() }
    }

    override suspend fun dashboard(): Dashboard = api.dashboard().data

    override suspend fun products(limit: Int, offset: Int): ProductPage =
        api.products(limit, offset)

    override suspend fun product(id: String): Product = api.product(id).data

    override suspend fun orders(page: Int, limit: Int, status: String?): OrderPage =
        api.orders(page, limit, status)

    override suspend fun order(id: String): OrderDetail = api.order(id).data

    private suspend fun storeSessionAndLoadProfile(token: String): AdminProfile {
        withContext(Dispatchers.IO) { tokenStore.write(token) }
        return try {
            api.profile().data
        } catch (error: HttpException) {
            if (error.code() == 401) withContext(Dispatchers.IO) { tokenStore.clear() }
            throw error
        }
    }

    private fun String?.required(field: String): String =
        this?.takeIf { it.isNotBlank() }
            ?: throw IllegalStateException("The API response did not contain a valid $field.")
}
