package com.shopademia.admin.data

import com.shopademia.admin.BuildConfig
import com.shopademia.admin.data.api.AdminApiFactory

class AppContainer(tokenStore: TokenStore) {
    val repository: AdminRepository by lazy {
        ApiAdminRepository(AdminApiFactory.create(BuildConfig.API_BASE_URL, tokenStore), tokenStore)
    }
}
