package com.shopademia.admin.ui

import com.shopademia.admin.data.AdminRepository
import com.shopademia.admin.data.LoginOutcome
import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.DashboardOrders
import com.shopademia.admin.data.model.DashboardProducts
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.OrderSummary
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage
import com.shopademia.admin.data.model.ProductPagination
import com.shopademia.admin.domain.AppError
import com.shopademia.admin.domain.LoadState
import java.io.IOException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class MainViewModelTest {
    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun signInLoadsDashboardAndNavigatesThroughReadOnlyResources() = runTest(dispatcher) {
        val repository = FakeAdminRepository()
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()
        assertEquals(AppScreen.LOGIN, viewModel.screen.value)

        viewModel.signIn("owner@example.test", "password", "")
        advanceUntilIdle()

        assertEquals(AppScreen.DASHBOARD, viewModel.screen.value)
        assertTrue(viewModel.dashboard.value is LoadState.Content<*>)
        viewModel.openProducts()
        advanceUntilIdle()
        assertEquals(AppScreen.PRODUCT_LIST, viewModel.screen.value)
        assertEquals(20, repository.requestedProductLimit)
        viewModel.openProduct("product-1")
        advanceUntilIdle()
        assertEquals(AppScreen.PRODUCT_DETAIL, viewModel.screen.value)
        assertTrue(viewModel.product.value is LoadState.Content<*>)
        viewModel.openOrders()
        advanceUntilIdle()
        assertEquals(AppScreen.ORDER_LIST, viewModel.screen.value)
        assertEquals(1, repository.requestedOrderPage)
        viewModel.openOrder("42")
        advanceUntilIdle()
        assertEquals(AppScreen.ORDER_DETAIL, viewModel.screen.value)
        assertTrue(viewModel.order.value is LoadState.Content<*>)
    }

    @Test
    fun platformAdminDoesNotLoadShopDashboardOrOpenShopResources() = runTest(dispatcher) {
        val repository = FakeAdminRepository(platformAdmin = true)
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()
        viewModel.signIn("platform@example.test", "password", "123456")
        advanceUntilIdle()

        assertEquals(AppScreen.DASHBOARD, viewModel.screen.value)
        assertEquals(0, repository.dashboardCalls)
        assertTrue((viewModel.dashboard.value as LoadState.Failure).error is AppError.Forbidden)
        viewModel.openProducts()
        assertEquals(AppScreen.DASHBOARD, viewModel.screen.value)
        assertEquals(0, repository.productListCalls)
    }

    @Test
    fun loginValidationIsShownWithoutCallingTheRepository() = runTest(dispatcher) {
        val repository = FakeAdminRepository()
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()

        viewModel.signIn("", "", "")

        assertTrue((viewModel.login.value as LoadState.Failure).error is AppError.Validation)
        assertEquals(0, repository.loginCalls)
    }

    @Test
    fun detailRefreshRetriesTheSelectedRecordAfterANetworkFailure() = runTest(dispatcher) {
        val repository = FakeAdminRepository(failFirstProductRead = true)
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()
        viewModel.signIn("owner@example.test", "password", "")
        advanceUntilIdle()

        viewModel.openProduct("product-1")
        advanceUntilIdle()
        assertTrue(viewModel.product.value is LoadState.Failure)

        viewModel.refreshCurrent()
        advanceUntilIdle()

        assertTrue(viewModel.product.value is LoadState.Content<*>)
        assertEquals(2, repository.productDetailCalls)
    }

    @Test
    fun mfaEnrollmentRequiresSixDigitsThenAuthenticates() = runTest(dispatcher) {
        val repository = FakeAdminRepository(platformAdmin = true, requireEnrollment = true)
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()
        viewModel.signIn("platform@example.test", "password", "")
        advanceUntilIdle()
        assertEquals(AppScreen.MFA_ENROLLMENT, viewModel.screen.value)

        viewModel.enrollMfa("12")
        assertTrue((viewModel.login.value as LoadState.Failure).error is AppError.Validation)

        viewModel.enrollMfa("123456")
        advanceUntilIdle()
        assertEquals(AppScreen.DASHBOARD, viewModel.screen.value)
        assertEquals(1, repository.enrollmentCalls)
    }

    @Test
    fun logoutRevokesSessionAndReturnsToLogin() = runTest(dispatcher) {
        val repository = FakeAdminRepository(initiallyAuthenticated = true)
        val viewModel = MainViewModel(repository)
        advanceUntilIdle()

        viewModel.signOut()
        advanceUntilIdle()

        assertEquals(1, repository.logoutCalls)
        assertEquals(AppScreen.LOGIN, viewModel.screen.value)
    }

    private class FakeAdminRepository(
        private val platformAdmin: Boolean = false,
        private val requireEnrollment: Boolean = false,
        private val initiallyAuthenticated: Boolean = false,
        private var failFirstProductRead: Boolean = false
    ) : AdminRepository {
        private val profile = AdminProfile(
            email = if (platformAdmin) "platform@example.test" else "owner@example.test",
            shopId = if (platformAdmin) null else "shop-1",
            role = if (platformAdmin) null else "owner",
            isPlatformAdmin = platformAdmin
        )
        var loginCalls = 0
        var enrollmentCalls = 0
        var dashboardCalls = 0
        var productListCalls = 0
        var productDetailCalls = 0
        var logoutCalls = 0
        var requestedProductLimit = 0
        var requestedOrderPage = 0
        private var authenticated = initiallyAuthenticated

        override suspend fun signIn(email: String, password: String, totpCode: String?): LoginOutcome {
            loginCalls++
            if (requireEnrollment) return LoginOutcome.MfaEnrollmentRequired("setup", "TESTKEY", "otpauth://test")
            authenticated = true
            return LoginOutcome.Authenticated(profile)
        }

        override suspend fun enrollMfa(setupToken: String, totpCode: String): AdminProfile {
            enrollmentCalls++
            authenticated = true
            return profile
        }

        override suspend fun restoreSession(): AdminProfile? = if (authenticated) profile else null

        override suspend fun signOut() {
            logoutCalls++
            authenticated = false
        }

        override suspend fun clearExpiredSession() {
            authenticated = false
        }

        override suspend fun dashboard(): Dashboard {
            dashboardCalls++
            return Dashboard(DashboardOrders(0, emptyMap()), DashboardProducts(0, 0, 0, "0"), "now")
        }

        override suspend fun products(limit: Int, offset: Int): ProductPage {
            productListCalls++
            requestedProductLimit = limit
            return ProductPage(listOf(product()), ProductPagination(limit, offset, 1, false))
        }

        override suspend fun product(id: String): Product {
            productDetailCalls++
            if (failFirstProductRead) {
                failFirstProductRead = false
                throw IOException("Synthetic network failure.")
            }
            return product()
        }

        override suspend fun orders(page: Int, limit: Int, status: String?): OrderPage {
            requestedOrderPage = page
            return OrderPage(listOf(OrderSummary("42", "SH-42", "Synthetic Buyer", "new", "2500", null)), page, limit, 1)
        }

        override suspend fun order(id: String): OrderDetail = OrderDetail(
            id = id,
            orderNumber = "SH-42",
            customerName = "Synthetic Buyer",
            phone = "01000000000",
            address = "Synthetic address",
            bkashNumber = null,
            items = null,
            subtotal = "2500",
            advanceAmount = "100",
            due = "2400",
            status = "new",
            advancePaymentStatus = "pending",
            advancePaymentCheckedAt = null,
            advancePaymentCheckedBy = null,
            createdAt = null,
            updatedAt = null
        )

        private fun product() = Product(
            id = "product-1",
            name = "Synthetic product",
            description = "Test description",
            price = "2500",
            oldPrice = null,
            category = "test",
            imageAlt = null,
            image = null,
            images = emptyList(),
            stockQuantity = 2,
            isAvailable = true,
            shopId = "shop-1",
            createdAt = null
        )
    }
}
