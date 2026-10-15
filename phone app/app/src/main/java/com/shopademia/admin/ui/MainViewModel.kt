package com.shopademia.admin.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.shopademia.admin.data.AdminRepository
import com.shopademia.admin.data.LoginOutcome
import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage
import com.shopademia.admin.domain.ApiErrorMapper
import com.shopademia.admin.domain.AppError
import com.shopademia.admin.domain.LoadState
import com.shopademia.admin.domain.contentOrNull
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

enum class AppScreen {
    STARTING,
    LOGIN,
    MFA_ENROLLMENT,
    DASHBOARD,
    PRODUCT_LIST,
    PRODUCT_DETAIL,
    ORDER_LIST,
    ORDER_DETAIL
}

data class MfaEnrollmentUi(val setupToken: String, val secret: String, val provisioningUri: String)

class MainViewModel(private val repository: AdminRepository) : ViewModel() {
    private val _screen = MutableStateFlow(AppScreen.STARTING)
    val screen = _screen.asStateFlow()

    private val _profile = MutableStateFlow<LoadState<AdminProfile>>(LoadState.Loading)
    val profile = _profile.asStateFlow()

    private val _login = MutableStateFlow<LoadState<AdminProfile>>(LoadState.Idle)
    val login = _login.asStateFlow()

    private val _mfaEnrollment = MutableStateFlow<MfaEnrollmentUi?>(null)
    val mfaEnrollment = _mfaEnrollment.asStateFlow()

    private val _dashboard = MutableStateFlow<LoadState<Dashboard>>(LoadState.Idle)
    val dashboard = _dashboard.asStateFlow()

    private val _products = MutableStateFlow<LoadState<ProductPage>>(LoadState.Idle)
    val products = _products.asStateFlow()

    private val _product = MutableStateFlow<LoadState<Product>>(LoadState.Idle)
    val product = _product.asStateFlow()

    private val _orders = MutableStateFlow<LoadState<OrderPage>>(LoadState.Idle)
    val orders = _orders.asStateFlow()

    private val _order = MutableStateFlow<LoadState<OrderDetail>>(LoadState.Idle)
    val order = _order.asStateFlow()

    private val _logout = MutableStateFlow<LoadState<Unit>>(LoadState.Idle)
    val logout = _logout.asStateFlow()

    private var productOffset = 0
    private var orderPage = 1
    private val pageLimit = 20
    private var selectedProductId: String? = null
    private var selectedOrderId: String? = null

    init {
        viewModelScope.launch {
            try {
                val current = repository.restoreSession()
                if (current == null) {
                    _profile.value = LoadState.Idle
                    _screen.value = AppScreen.LOGIN
                } else {
                    startAuthenticatedSession(current)
                }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                applyAuthFailure(error, _profile)
            }
        }
    }

    fun signIn(email: String, password: String, totpCode: String) {
        if (email.isBlank() || password.isBlank()) {
            _login.value = LoadState.Failure(AppError.Validation("Enter your administrator email and password."))
            return
        }
        viewModelScope.launch {
            _login.value = LoadState.Loading
            try {
                when (val outcome = repository.signIn(email, password, totpCode)) {
                    is LoginOutcome.Authenticated -> {
                        _login.value = LoadState.Content(outcome.profile)
                        startAuthenticatedSession(outcome.profile)
                    }
                    is LoginOutcome.MfaEnrollmentRequired -> {
                        _mfaEnrollment.value = MfaEnrollmentUi(
                            outcome.setupToken,
                            outcome.secret,
                            outcome.provisioningUri
                        )
                        _login.value = LoadState.Idle
                        _screen.value = AppScreen.MFA_ENROLLMENT
                    }
                }
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _login.value = LoadState.Failure(ApiErrorMapper.from(error))
            }
        }
    }

    fun enrollMfa(code: String) {
        val enrollment = _mfaEnrollment.value ?: return
        if (!code.matches(Regex("^\\d{6}$"))) {
            _login.value = LoadState.Failure(AppError.Validation("Enter the current six-digit authenticator code."))
            return
        }
        viewModelScope.launch {
            _login.value = LoadState.Loading
            try {
                val current = repository.enrollMfa(enrollment.setupToken, code)
                _mfaEnrollment.value = null
                _login.value = LoadState.Content(current)
                startAuthenticatedSession(current)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                _login.value = LoadState.Failure(ApiErrorMapper.from(error))
            }
        }
    }

    fun cancelMfaEnrollment() {
        _mfaEnrollment.value = null
        _login.value = LoadState.Idle
        _screen.value = AppScreen.LOGIN
    }

    fun openDashboard() {
        _screen.value = AppScreen.DASHBOARD
        val current = _profile.value.contentOrNull()
        if (current?.isPlatformAdmin == true) {
            _dashboard.value = LoadState.Failure(
                AppError.Forbidden("Platform administrators cannot access shop dashboard, products, or orders.")
            )
        } else {
            loadDashboard()
        }
    }

    fun openProducts() {
        if (!canOpenShopData()) return
        productOffset = 0
        _products.value = LoadState.Loading
        _screen.value = AppScreen.PRODUCT_LIST
        loadProducts()
    }

    fun loadNextProducts() {
        val page = _products.value.contentOrNull() ?: return
        if (!page.pagination.hasMore) return
        productOffset = page.pagination.offset + page.pagination.limit
        loadProducts()
    }

    fun loadPreviousProducts() {
        val page = _products.value.contentOrNull() ?: return
        if (page.pagination.offset == 0) return
        productOffset = (page.pagination.offset - page.pagination.limit).coerceAtLeast(0)
        loadProducts()
    }

    fun openProduct(id: String) {
        if (!canOpenShopData()) return
        selectedProductId = id
        _product.value = LoadState.Loading
        _screen.value = AppScreen.PRODUCT_DETAIL
        viewModelScope.launch {
            try {
                _product.value = LoadState.Content(repository.product(id))
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                setFailure(_product, error)
            }
        }
    }

    fun openOrders() {
        if (!canOpenShopData()) return
        orderPage = 1
        _screen.value = AppScreen.ORDER_LIST
        loadOrders()
    }

    fun loadNextOrders() {
        val page = _orders.value.contentOrNull() ?: return
        if (page.page * page.limit >= page.total) return
        orderPage = page.page + 1
        loadOrders()
    }

    fun loadPreviousOrders() {
        if (orderPage <= 1) return
        orderPage -= 1
        loadOrders()
    }

    fun openOrder(id: String) {
        if (!canOpenShopData()) return
        selectedOrderId = id
        _order.value = LoadState.Loading
        _screen.value = AppScreen.ORDER_DETAIL
        viewModelScope.launch {
            try {
                _order.value = LoadState.Content(repository.order(id))
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                setFailure(_order, error)
            }
        }
    }

    fun backToDashboard() = openDashboard()

    fun backToProducts() {
        _screen.value = AppScreen.PRODUCT_LIST
    }

    fun backToOrders() {
        _screen.value = AppScreen.ORDER_LIST
    }

    fun refreshCurrent() {
        when (_screen.value) {
            AppScreen.DASHBOARD -> openDashboard()
            AppScreen.PRODUCT_LIST -> loadProducts()
            AppScreen.PRODUCT_DETAIL -> selectedProductId?.let(::openProduct)
            AppScreen.ORDER_LIST -> loadOrders()
            AppScreen.ORDER_DETAIL -> selectedOrderId?.let(::openOrder)
            else -> Unit
        }
    }

    fun signOut() {
        viewModelScope.launch {
            _logout.value = LoadState.Loading
            try {
                repository.signOut()
                _profile.value = LoadState.Idle
                _mfaEnrollment.value = null
                _login.value = LoadState.Idle
                _logout.value = LoadState.Idle
                clearWorkspace()
                _screen.value = AppScreen.LOGIN
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                val mapped = ApiErrorMapper.from(error)
                if (mapped is AppError.Unauthorized) {
                    clearExpiredSession()
                } else {
                    _logout.value = LoadState.Failure(mapped)
                }
            }
        }
    }

    private suspend fun startAuthenticatedSession(current: AdminProfile) {
        _profile.value = LoadState.Content(current)
        if (current.isPlatformAdmin) {
            _screen.value = AppScreen.DASHBOARD
            _dashboard.value = LoadState.Failure(
                AppError.Forbidden("This platform account cannot access the shop-admin workspace.")
            )
        } else {
            _screen.value = AppScreen.DASHBOARD
            loadDashboard()
        }
    }

    private fun loadDashboard() {
        if (_profile.value.contentOrNull()?.isPlatformAdmin == true) {
            return
        }
        _dashboard.value = LoadState.Loading
        viewModelScope.launch {
            try {
                _dashboard.value = LoadState.Content(repository.dashboard())
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                setFailure(_dashboard, error)
            }
        }
    }

    private fun loadProducts() {
        _products.value = LoadState.Loading
        viewModelScope.launch {
            try {
                val result = repository.products(limit = pageLimit, offset = productOffset)
                _products.value = if (result.data.isEmpty()) LoadState.Empty else LoadState.Content(result)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                setFailure(_products, error)
            }
        }
    }

    private fun loadOrders() {
        _orders.value = LoadState.Loading
        viewModelScope.launch {
            try {
                val result = repository.orders(page = orderPage, limit = pageLimit, status = null)
                _orders.value = if (result.data.isEmpty()) LoadState.Empty else LoadState.Content(result)
            } catch (error: Exception) {
                if (error is CancellationException) throw error
                setFailure(_orders, error)
            }
        }
    }

    private suspend fun <T> setFailure(state: MutableStateFlow<LoadState<T>>, error: Exception) {
        val mapped = ApiErrorMapper.from(error)
        if (mapped is AppError.Unauthorized) {
            clearExpiredSession()
        } else {
            state.value = LoadState.Failure(mapped)
        }
    }

    private suspend fun applyAuthFailure(
        error: Exception,
        state: MutableStateFlow<LoadState<AdminProfile>>
    ) {
        val mapped = ApiErrorMapper.from(error)
        state.value = LoadState.Failure(mapped)
        if (mapped is AppError.Unauthorized) clearExpiredSession()
        else _screen.value = AppScreen.LOGIN
    }

    private suspend fun clearExpiredSession() {
        try {
            repository.clearExpiredSession()
            _profile.value = LoadState.Idle
            _login.value = LoadState.Failure(
                AppError.Unauthorized("Your admin session has expired. Sign in again.")
            )
            _logout.value = LoadState.Idle
            clearWorkspace()
            _screen.value = AppScreen.LOGIN
        } catch (error: Exception) {
            if (error is CancellationException) throw error
            _login.value = LoadState.Failure(ApiErrorMapper.from(error))
        }
    }

    private fun clearWorkspace() {
        selectedProductId = null
        selectedOrderId = null
        _dashboard.value = LoadState.Idle
        _products.value = LoadState.Idle
        _product.value = LoadState.Idle
        _orders.value = LoadState.Idle
        _order.value = LoadState.Idle
    }

    private fun canOpenShopData(): Boolean =
        _profile.value.contentOrNull()?.isPlatformAdmin == false

    class Factory(private val repository: AdminRepository) : ViewModelProvider.Factory {
        @Suppress("UNCHECKED_CAST")
        override fun <T : ViewModel> create(modelClass: Class<T>): T {
            require(modelClass.isAssignableFrom(MainViewModel::class.java))
            return MainViewModel(repository) as T
        }
    }
}
