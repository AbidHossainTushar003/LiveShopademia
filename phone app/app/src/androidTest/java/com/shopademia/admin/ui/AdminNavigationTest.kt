package com.shopademia.admin.ui

import androidx.test.core.app.ActivityScenario
import androidx.test.core.app.ApplicationProvider
import androidx.test.espresso.Espresso.onView
import androidx.test.espresso.action.ViewActions.click
import androidx.test.espresso.action.ViewActions.closeSoftKeyboard
import androidx.test.espresso.action.ViewActions.typeText
import androidx.test.espresso.assertion.ViewAssertions.matches
import androidx.test.espresso.matcher.ViewMatchers.isDisplayed
import androidx.test.espresso.matcher.ViewMatchers.withId
import androidx.test.espresso.matcher.ViewMatchers.withText
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.shopademia.admin.R
import com.shopademia.admin.ShopademiaApplication
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
import org.hamcrest.Matchers.containsString
import org.junit.After
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AdminNavigationTest {
    private val application = ApplicationProvider.getApplicationContext<ShopademiaApplication>()

    @After
    fun tearDown() {
        application.repositoryOverride = null
    }

    @Test
    fun shopAdminCanSignInAndNavigateDashboardProductsOrdersAndDetails() {
        application.repositoryOverride = FakeAdminRepository()
        ActivityScenario.launch(MainActivity::class.java).use {
            onView(withId(R.id.input_email)).perform(typeText("owner@example.test"))
            onView(withId(R.id.input_password)).perform(typeText("test-password"), closeSoftKeyboard())
            onView(withId(R.id.button_sign_in)).perform(click())
            onView(withId(R.id.dashboard_title)).check(matches(isDisplayed()))
            onView(withText(containsString("Orders"))).check(matches(isDisplayed()))

            onView(withId(R.id.button_products)).perform(click())
            onView(withText(containsString("Synthetic product"))).check(matches(isDisplayed())).perform(click())
            onView(withId(R.id.detail_title)).check(matches(withText("Synthetic product")))
            onView(withId(R.id.button_detail_back)).perform(click())

            onView(withId(R.id.button_orders)).perform(click())
            onView(withText(containsString("SH-42"))).check(matches(isDisplayed())).perform(click())
            onView(withId(R.id.detail_title)).check(matches(withText("SH-42")))
            onView(withId(R.id.button_detail_back)).perform(click())
            onView(withId(R.id.button_logout)).perform(click())
            onView(withId(R.id.button_sign_in)).check(matches(isDisplayed()))
        }
        assertTrue(application.repositoryOverride == null)
    }

    private class FakeAdminRepository : AdminRepository {
        private val profile = AdminProfile("owner@example.test", "shop-test", "owner", false)
        private val product = Product(
            id = "product-test",
            name = "Synthetic product",
            description = "Integration UI test fixture",
            price = "2500",
            oldPrice = null,
            category = "test",
            imageAlt = null,
            image = null,
            images = emptyList(),
            stockQuantity = 2,
            isAvailable = true,
            shopId = "shop-test",
            createdAt = null
        )

        override suspend fun signIn(email: String, password: String, totpCode: String?) =
            LoginOutcome.Authenticated(profile)

        override suspend fun enrollMfa(setupToken: String, totpCode: String) = profile
        override suspend fun restoreSession(): AdminProfile? = null
        override suspend fun signOut() = Unit
        override suspend fun clearExpiredSession() = Unit
        override suspend fun dashboard() =
            Dashboard(DashboardOrders(1, mapOf("new" to 1)), DashboardProducts(1, 1, 0, "2"), "now")

        override suspend fun products(limit: Int, offset: Int) =
            ProductPage(listOf(product), ProductPagination(limit, offset, 1, false))

        override suspend fun product(id: String) = product
        override suspend fun orders(page: Int, limit: Int, status: String?) =
            OrderPage(listOf(OrderSummary("42", "SH-42", "Synthetic Buyer", "new", "2500", null)), page, limit, 1)

        override suspend fun order(id: String) = OrderDetail(
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
    }
}
