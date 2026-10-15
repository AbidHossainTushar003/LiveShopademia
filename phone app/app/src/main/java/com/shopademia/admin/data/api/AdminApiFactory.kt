package com.shopademia.admin.data.api

import com.shopademia.admin.data.TokenStore
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object AdminApiFactory {
    fun create(baseUrl: String, tokenStore: TokenStore): AdminApi {
        val client = OkHttpClient.Builder()
            .cookieJar(CookieJar.NO_COOKIES)
            .addInterceptor { chain ->
                val original = chain.request()
                val authEndpoint = original.url.encodedPath.endsWith("/admin/login")
                    || original.url.encodedPath.endsWith("/admin/mfa/enroll")
                val request = original.newBuilder().apply {
                    if (!authEndpoint) tokenStore.read()?.let { token ->
                        header("Authorization", "Bearer $token")
                    }
                }.build()
                chain.proceed(request)
            }
            .build()
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AdminApi::class.java)
    }
}
