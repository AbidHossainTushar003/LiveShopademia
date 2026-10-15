package com.shopademia.admin.data.api

import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.ApiEnvelope
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.LoginRequest
import com.shopademia.admin.data.model.LoginResponse
import com.shopademia.admin.data.model.MfaEnrollmentRequest
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface AdminApi {
    @POST("admin/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @POST("admin/mfa/enroll")
    suspend fun enrollMfa(@Body request: MfaEnrollmentRequest): LoginResponse

    @GET("admin/profile")
    suspend fun profile(): ApiEnvelope<AdminProfile>

    @POST("admin/logout")
    suspend fun logout()

    @GET("admin/dashboard")
    suspend fun dashboard(): ApiEnvelope<Dashboard>

    @GET("admin/products")
    suspend fun products(
        @Query("limit") limit: Int = 50,
        @Query("offset") offset: Int = 0
    ): ProductPage

    @GET("admin/products/{id}")
    suspend fun product(@Path("id") id: String): ApiEnvelope<Product>

    @GET("admin/orders")
    suspend fun orders(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 20,
        @Query("status") status: String? = null
    ): OrderPage

    @GET("admin/orders/{id}")
    suspend fun order(@Path("id") id: String): ApiEnvelope<OrderDetail>
}
