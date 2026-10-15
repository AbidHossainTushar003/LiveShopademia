package com.shopademia.admin.data

import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage

sealed interface LoginOutcome {
    data class Authenticated(val profile: AdminProfile) : LoginOutcome
    data class MfaEnrollmentRequired(
        val setupToken: String,
        val secret: String,
        val provisioningUri: String
    ) : LoginOutcome
}

interface AdminRepository {
    suspend fun signIn(email: String, password: String, totpCode: String?): LoginOutcome
    suspend fun enrollMfa(setupToken: String, totpCode: String): AdminProfile
    suspend fun restoreSession(): AdminProfile?
    suspend fun signOut()
    suspend fun clearExpiredSession()
    suspend fun dashboard(): Dashboard
    suspend fun products(limit: Int, offset: Int): ProductPage
    suspend fun product(id: String): Product
    suspend fun orders(page: Int, limit: Int, status: String?): OrderPage
    suspend fun order(id: String): OrderDetail
}
