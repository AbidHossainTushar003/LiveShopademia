package com.shopademia.admin.data.model

import com.google.gson.JsonElement

data class ApiEnvelope<T>(val data: T)

data class LoginRequest(
    val email: String,
    val password: String,
    val totpCode: String? = null
)

data class LoginResponse(
    val token: String? = null,
    val expiresIn: Long? = null,
    val mfaSetupRequired: Boolean? = null,
    val setupToken: String? = null,
    val totpSecret: String? = null,
    val provisioningUri: String? = null
)

data class MfaEnrollmentRequest(val setupToken: String, val totpCode: String)

data class AdminProfile(
    val email: String,
    val shopId: String?,
    val role: String?,
    val isPlatformAdmin: Boolean
)

data class Dashboard(
    val orders: DashboardOrders,
    val products: DashboardProducts,
    val generatedAt: String
)

data class DashboardOrders(val total: Int, val byStatus: Map<String, Int>)

data class DashboardProducts(
    val total: Int,
    val available: Int,
    val outOfStock: Int,
    val stockUnits: String
)

data class Product(
    val id: String,
    val name: String,
    val description: String?,
    val price: String,
    val oldPrice: String?,
    val category: String?,
    val imageAlt: String?,
    val image: String?,
    val images: List<String>?,
    val stockQuantity: Long,
    val isAvailable: Boolean,
    val shopId: String,
    val createdAt: String?
)

data class ProductPage(
    val data: List<Product>,
    val pagination: ProductPagination
)

data class ProductPagination(
    val limit: Int,
    val offset: Int,
    val total: Int,
    val hasMore: Boolean
)

data class OrderPage(
    val data: List<OrderSummary>,
    val page: Int,
    val limit: Int,
    val total: Int
)

data class OrderSummary(
    val id: String,
    val orderNumber: String,
    val customerName: String,
    val status: String,
    val subtotal: String,
    val createdAt: String?
)

data class OrderDetail(
    val id: String,
    val orderNumber: String,
    val customerName: String,
    val phone: String,
    val address: String,
    val bkashNumber: String?,
    val items: JsonElement?,
    val subtotal: String,
    val advanceAmount: String,
    val due: String,
    val status: String,
    val advancePaymentStatus: String,
    val advancePaymentCheckedAt: String?,
    val advancePaymentCheckedBy: String?,
    val createdAt: String?,
    val updatedAt: String?
)

data class ApiErrorBody(val error: String?)
