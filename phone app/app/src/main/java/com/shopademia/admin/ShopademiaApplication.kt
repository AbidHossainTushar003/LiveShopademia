package com.shopademia.admin

import android.app.Application
import com.shopademia.admin.data.AdminRepository
import com.shopademia.admin.data.AndroidKeystoreTokenStore
import com.shopademia.admin.data.AppContainer

class ShopademiaApplication : Application() {
    private lateinit var container: AppContainer
    var repositoryOverride: AdminRepository? = null

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(AndroidKeystoreTokenStore(this))
    }

    fun adminRepository(): AdminRepository = repositoryOverride ?: container.repository
}
