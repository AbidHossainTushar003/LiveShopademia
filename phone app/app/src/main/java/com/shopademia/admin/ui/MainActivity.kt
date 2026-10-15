package com.shopademia.admin.ui

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.EditText
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import com.google.android.material.button.MaterialButton
import com.shopademia.admin.R
import com.shopademia.admin.ShopademiaApplication
import com.shopademia.admin.data.model.AdminProfile
import com.shopademia.admin.data.model.Dashboard
import com.shopademia.admin.data.model.OrderDetail
import com.shopademia.admin.data.model.OrderPage
import com.shopademia.admin.data.model.Product
import com.shopademia.admin.data.model.ProductPage
import com.shopademia.admin.domain.LoadState
import com.shopademia.admin.domain.contentOrNull
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val viewModel: MainViewModel by viewModels {
        MainViewModel.Factory((application as ShopademiaApplication).adminRepository())
    }

    private var displayedScreen: AppScreen? = null
    private lateinit var host: FrameLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContentView(R.layout.activity_main)
        host = findViewById(R.id.screen_host)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when (viewModel.screen.value) {
                    AppScreen.PRODUCT_DETAIL -> viewModel.backToProducts()
                    AppScreen.ORDER_DETAIL -> viewModel.backToOrders()
                    AppScreen.PRODUCT_LIST, AppScreen.ORDER_LIST -> viewModel.backToDashboard()
                    AppScreen.MFA_ENROLLMENT -> viewModel.cancelMfaEnrollment()
                    AppScreen.DASHBOARD -> moveTaskToBack(true)
                    else -> finish()
                }
            }
        })

        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch { viewModel.screen.collect(::showScreen) }
                launch { viewModel.profile.collect { renderProfile(it) } }
                launch { viewModel.login.collect { renderLogin(it) } }
                launch { viewModel.mfaEnrollment.collect { renderMfaSecret(it?.secret) } }
                launch { viewModel.dashboard.collect { renderDashboard(it) } }
                launch { viewModel.products.collect { renderProducts(it) } }
                launch { viewModel.product.collect { renderProduct(it) } }
                launch { viewModel.orders.collect { renderOrders(it) } }
                launch { viewModel.order.collect { renderOrder(it) } }
                launch { viewModel.logout.collect { renderLogout(it) } }
            }
        }
    }

    private fun showScreen(screen: AppScreen) {
        if (displayedScreen == screen) {
            renderAll()
            return
        }
        displayedScreen = screen
        host.removeAllViews()
        val layout = when (screen) {
            AppScreen.STARTING -> R.layout.screen_loading
            AppScreen.LOGIN -> R.layout.screen_login
            AppScreen.MFA_ENROLLMENT -> R.layout.screen_mfa_enrollment
            AppScreen.DASHBOARD -> R.layout.screen_dashboard
            AppScreen.PRODUCT_LIST, AppScreen.ORDER_LIST -> R.layout.screen_list
            AppScreen.PRODUCT_DETAIL, AppScreen.ORDER_DETAIL -> R.layout.screen_detail
        }
        LayoutInflater.from(this).inflate(layout, host, true)
        when (screen) {
            AppScreen.LOGIN -> bindLoginActions()
            AppScreen.MFA_ENROLLMENT -> bindMfaActions()
            AppScreen.DASHBOARD -> bindDashboardActions()
            AppScreen.PRODUCT_LIST -> bindProductListActions()
            AppScreen.ORDER_LIST -> bindOrderListActions()
            AppScreen.PRODUCT_DETAIL -> bindProductDetailActions()
            AppScreen.ORDER_DETAIL -> bindOrderDetailActions()
            AppScreen.STARTING -> Unit
        }
        renderAll()
    }

    private fun bindLoginActions() {
        findViewById<MaterialButton>(R.id.button_sign_in).setOnClickListener {
            val email = findViewById<EditText>(R.id.input_email).text.toString()
            val password = findViewById<EditText>(R.id.input_password).text.toString()
            val code = findViewById<EditText>(R.id.input_totp).text.toString()
            findViewById<EditText>(R.id.input_password).text?.clear()
            findViewById<EditText>(R.id.input_totp).text?.clear()
            viewModel.signIn(email, password, code)
        }
    }

    private fun bindMfaActions() {
        findViewById<MaterialButton>(R.id.button_complete_enrollment).setOnClickListener {
            val code = findViewById<EditText>(R.id.input_enrollment_code).text.toString()
            findViewById<EditText>(R.id.input_enrollment_code).text?.clear()
            viewModel.enrollMfa(code)
        }
        findViewById<MaterialButton>(R.id.button_cancel_enrollment).setOnClickListener {
            viewModel.cancelMfaEnrollment()
        }
    }

    private fun bindDashboardActions() {
        findViewById<MaterialButton>(R.id.button_products).setOnClickListener { viewModel.openProducts() }
        findViewById<MaterialButton>(R.id.button_orders).setOnClickListener { viewModel.openOrders() }
        findViewById<MaterialButton>(R.id.button_refresh).setOnClickListener { viewModel.refreshCurrent() }
        findViewById<MaterialButton>(R.id.button_logout).setOnClickListener { viewModel.signOut() }
    }

    private fun bindProductListActions() {
        findViewById<MaterialButton>(R.id.button_back).setOnClickListener { viewModel.backToDashboard() }
        findViewById<MaterialButton>(R.id.button_previous).setOnClickListener { viewModel.loadPreviousProducts() }
        findViewById<MaterialButton>(R.id.button_next).setOnClickListener { viewModel.loadNextProducts() }
        findViewById<MaterialButton>(R.id.button_list_refresh).setOnClickListener { viewModel.refreshCurrent() }
    }

    private fun bindOrderListActions() {
        findViewById<MaterialButton>(R.id.button_back).setOnClickListener { viewModel.backToDashboard() }
        findViewById<MaterialButton>(R.id.button_previous).setOnClickListener { viewModel.loadPreviousOrders() }
        findViewById<MaterialButton>(R.id.button_next).setOnClickListener { viewModel.loadNextOrders() }
        findViewById<MaterialButton>(R.id.button_list_refresh).setOnClickListener { viewModel.refreshCurrent() }
    }

    private fun bindProductDetailActions() {
        findViewById<MaterialButton>(R.id.button_detail_back).setOnClickListener { viewModel.backToProducts() }
        findViewById<MaterialButton>(R.id.button_detail_refresh).setOnClickListener { viewModel.refreshCurrent() }
    }

    private fun bindOrderDetailActions() {
        findViewById<MaterialButton>(R.id.button_detail_back).setOnClickListener { viewModel.backToOrders() }
        findViewById<MaterialButton>(R.id.button_detail_refresh).setOnClickListener { viewModel.refreshCurrent() }
    }

    private fun renderAll() {
        renderProfile(viewModel.profile.value)
        renderLogin(viewModel.login.value)
        renderMfaSecret(viewModel.mfaEnrollment.value?.secret)
        renderDashboard(viewModel.dashboard.value)
        renderProducts(viewModel.products.value)
        renderProduct(viewModel.product.value)
        renderOrders(viewModel.orders.value)
        renderOrder(viewModel.order.value)
        renderLogout(viewModel.logout.value)
    }

    private fun renderProfile(state: LoadState<AdminProfile>) {
        if (displayedScreen != AppScreen.DASHBOARD) return
        val profile = state.contentOrNull() ?: return
        findViewById<TextView>(R.id.profile_label).text =
            if (profile.isPlatformAdmin) "Platform administrator"
            else "${profile.email} · ${profile.role ?: "Shop member"}"
        if (profile.isPlatformAdmin) {
            findViewById<MaterialButton>(R.id.button_products).visibility = View.GONE
            findViewById<MaterialButton>(R.id.button_orders).visibility = View.GONE
            findViewById<View>(R.id.dashboard_metrics).visibility = View.GONE
        }
    }

    private fun renderLogin(state: LoadState<AdminProfile>) {
        if (displayedScreen != AppScreen.LOGIN) return
        val message = findViewById<TextView>(R.id.login_message)
        val progress = findViewById<ProgressBar>(R.id.login_progress)
        val button = findViewById<MaterialButton>(R.id.button_sign_in)
        when (state) {
            LoadState.Loading -> {
                progress.visibility = View.VISIBLE
                message.visibility = View.GONE
                button.isEnabled = false
            }
            is LoadState.Failure -> {
                progress.visibility = View.GONE
                message.text = state.error.message
                message.visibility = View.VISIBLE
                button.isEnabled = true
            }
            else -> {
                progress.visibility = View.GONE
                message.visibility = View.GONE
                button.isEnabled = true
            }
        }
    }

    private fun renderMfaSecret(secret: String?) {
        if (displayedScreen != AppScreen.MFA_ENROLLMENT) return
        findViewById<TextView>(R.id.mfa_secret).text = secret.orEmpty()
        val state = viewModel.login.value
        val message = findViewById<TextView>(R.id.mfa_message)
        val progress = findViewById<ProgressBar>(R.id.mfa_progress)
        when (state) {
            LoadState.Loading -> {
                progress.visibility = View.VISIBLE
                message.visibility = View.GONE
            }
            is LoadState.Failure -> {
                progress.visibility = View.GONE
                message.text = state.error.message
                message.visibility = View.VISIBLE
            }
            else -> {
                progress.visibility = View.GONE
                message.visibility = View.GONE
            }
        }
    }

    private fun renderDashboard(state: LoadState<Dashboard>) {
        if (displayedScreen != AppScreen.DASHBOARD) return
        val message = findViewById<TextView>(R.id.dashboard_message)
        val progress = findViewById<ProgressBar>(R.id.dashboard_progress)
        val metrics = findViewById<View>(R.id.dashboard_metrics)
        when (state) {
            LoadState.Loading -> {
                message.visibility = View.GONE
                progress.visibility = View.VISIBLE
                metrics.visibility = View.GONE
            }
            LoadState.Empty -> {
                progress.visibility = View.GONE
                message.text = "No dashboard data is available yet."
                message.setTextColor(getColor(R.color.muted_ink))
                message.visibility = View.VISIBLE
                metrics.visibility = View.GONE
            }
            is LoadState.Failure -> {
                progress.visibility = View.GONE
                message.text = state.error.message
                message.setTextColor(getColor(R.color.error))
                message.visibility = View.VISIBLE
                metrics.visibility = View.GONE
            }
            is LoadState.Content<*> -> {
                progress.visibility = View.GONE
                message.visibility = View.GONE
                metrics.visibility = View.VISIBLE
                val data = state.contentOrNull() ?: return
                findViewById<TextView>(R.id.orders_metric).text =
                    "Orders  ·  ${data.orders.total} total\n${formatStatuses(data.orders.byStatus)}"
                findViewById<TextView>(R.id.products_metric).text =
                    "Products  ·  ${data.products.total} total"
                findViewById<TextView>(R.id.stock_metric).text =
                    "Stock units  ·  ${data.products.stockUnits}"
                findViewById<TextView>(R.id.availability_metric).text =
                    "${data.products.available} available  ·  ${data.products.outOfStock} out of stock"
            }
            LoadState.Idle -> {
                progress.visibility = View.GONE
                metrics.visibility = View.GONE
            }
        }
    }

    private fun renderProducts(state: LoadState<ProductPage>) {
        if (displayedScreen != AppScreen.PRODUCT_LIST) return
        findViewById<TextView>(R.id.list_title).setText(R.string.products)
        val page = state.contentOrNull()
        renderListStatus(state, page?.data?.isEmpty() == true, getString(R.string.empty_products))
        val items = findViewById<LinearLayout>(R.id.list_items)
        items.removeAllViews()
        page?.data?.forEach { product ->
            addRow(items, "${product.name}\nBDT ${product.price}  ·  Stock ${product.stockQuantity}") {
                viewModel.openProduct(product.id)
            }
        }
        findViewById<TextView>(R.id.page_label).text =
            page?.let { "Showing ${it.pagination.offset + 1}–${it.pagination.offset + it.data.size} of ${it.pagination.total}" }
                .orEmpty()
        findViewById<MaterialButton>(R.id.button_previous).isEnabled =
            page != null && page.pagination.offset > 0
        findViewById<MaterialButton>(R.id.button_next).isEnabled =
            page?.pagination?.hasMore == true
    }

    private fun renderOrders(state: LoadState<OrderPage>) {
        if (displayedScreen != AppScreen.ORDER_LIST) return
        findViewById<TextView>(R.id.list_title).setText(R.string.orders)
        val page = state.contentOrNull()
        renderListStatus(state, page?.data?.isEmpty() == true, getString(R.string.empty_orders))
        val items = findViewById<LinearLayout>(R.id.list_items)
        items.removeAllViews()
        page?.data?.forEach { order ->
            addRow(items, "${order.orderNumber}  ·  ${order.status}\n${order.customerName}  ·  BDT ${order.subtotal}") {
                viewModel.openOrder(order.id)
            }
        }
        findViewById<TextView>(R.id.page_label).text =
            page?.let { "Page ${it.page}  ·  ${it.total} orders" }.orEmpty()
        findViewById<MaterialButton>(R.id.button_previous).isEnabled = page?.page?.let { it > 1 } == true
        findViewById<MaterialButton>(R.id.button_next).isEnabled =
            page?.let { it.page * it.limit < it.total } == true
    }

    private fun renderListStatus(state: LoadState<*>, empty: Boolean, emptyMessage: String) {
        val message = findViewById<TextView>(R.id.list_message)
        val progress = findViewById<ProgressBar>(R.id.list_progress)
        val items = findViewById<LinearLayout>(R.id.list_items)
        when {
            state is LoadState.Loading -> {
                message.visibility = View.GONE
                progress.visibility = View.VISIBLE
                items.removeAllViews()
                findViewById<MaterialButton>(R.id.button_list_refresh).isEnabled = false
            }
            state is LoadState.Failure -> {
                progress.visibility = View.GONE
                message.text = state.error.message
                message.visibility = View.VISIBLE
                items.removeAllViews()
                findViewById<MaterialButton>(R.id.button_list_refresh).isEnabled = true
            }
            state is LoadState.Empty || empty -> {
                progress.visibility = View.GONE
                message.text = emptyMessage
                message.setTextColor(getColor(R.color.muted_ink))
                message.visibility = View.VISIBLE
                items.removeAllViews()
                findViewById<MaterialButton>(R.id.button_list_refresh).isEnabled = true
            }
            else -> {
                progress.visibility = View.GONE
                message.visibility = View.GONE
                findViewById<MaterialButton>(R.id.button_list_refresh).isEnabled = true
            }
        }
    }

    private fun renderProduct(state: LoadState<Product>) {
        if (displayedScreen != AppScreen.PRODUCT_DETAIL) return
        val title = findViewById<TextView>(R.id.detail_title)
        val content = findViewById<TextView>(R.id.detail_content)
        when (state) {
            LoadState.Loading -> renderDetailState("Loading product…", true)
            LoadState.Empty -> renderDetailState(getString(R.string.empty_products), false)
            is LoadState.Failure -> renderDetailState(state.error.message, false)
            is LoadState.Content<*> -> {
                val product = state.contentOrNull() ?: return
                title.text = product.name
                content.text = buildString {
                    append("Price: BDT ${product.price}")
                    product.oldPrice?.let { append("\nPrevious price: BDT $it") }
                    append("\nCategory: ${product.category ?: "—"}")
                    append("\nStock: ${product.stockQuantity}")
                    append("\nAvailability: ${if (product.isAvailable) "Available" else "Unavailable"}")
                    product.description?.takeIf { it.isNotBlank() }?.let { append("\n\n$it") }
                }
                renderDetailState(null, false)
            }
            LoadState.Idle -> renderDetailState(null, false)
        }
    }

    private fun renderOrder(state: LoadState<OrderDetail>) {
        if (displayedScreen != AppScreen.ORDER_DETAIL) return
        val title = findViewById<TextView>(R.id.detail_title)
        val content = findViewById<TextView>(R.id.detail_content)
        when (state) {
            LoadState.Loading -> renderDetailState("Loading order…", true)
            LoadState.Empty -> renderDetailState(getString(R.string.empty_orders), false)
            is LoadState.Failure -> renderDetailState(state.error.message, false)
            is LoadState.Content<*> -> {
                val order = state.contentOrNull() ?: return
                title.text = order.orderNumber
                content.text = buildString {
                    append("Status: ${order.status}")
                    append("\nCustomer: ${order.customerName}")
                    append("\nPhone: ${order.phone}")
                    append("\nAddress: ${order.address}")
                    order.bkashNumber?.let { append("\nPayment reference: $it") }
                    append("\nSubtotal: BDT ${order.subtotal}")
                    append("\nAdvance payment: BDT ${order.advanceAmount} (${order.advancePaymentStatus})")
                    append("\nDue: BDT ${order.due}")
                    append("\n\nItems\n${order.items?.toString() ?: "No item details returned."}")
                }
                renderDetailState(null, false)
            }
            LoadState.Idle -> renderDetailState(null, false)
        }
    }

    private fun renderDetailState(messageText: String?, loading: Boolean) {
        val message = findViewById<TextView>(R.id.detail_message)
        val progress = findViewById<ProgressBar>(R.id.detail_progress)
        val content = findViewById<TextView>(R.id.detail_content)
        if (loading) {
            message.visibility = View.GONE
            progress.visibility = View.VISIBLE
            content.visibility = View.GONE
        } else {
            progress.visibility = View.GONE
            message.text = messageText.orEmpty()
            message.visibility = if (messageText == null) View.GONE else View.VISIBLE
            content.visibility = if (messageText == null) View.VISIBLE else View.GONE
        }
    }

    private fun renderLogout(state: LoadState<Unit>) {
        if (displayedScreen != AppScreen.DASHBOARD) return
        val message = findViewById<TextView>(R.id.logout_message)
        val button = findViewById<MaterialButton>(R.id.button_logout)
        when (state) {
            LoadState.Loading -> {
                button.isEnabled = false
                message.visibility = View.GONE
            }
            is LoadState.Failure -> {
                button.isEnabled = true
                message.text = state.error.message
                message.visibility = View.VISIBLE
            }
            else -> {
                button.isEnabled = true
                message.visibility = View.GONE
            }
        }
    }

    private fun addRow(parent: LinearLayout, label: String, action: () -> Unit) {
        val button = MaterialButton(this).apply {
            text = label
            isAllCaps = false
            contentDescription = label.replace('\n', ' ')
            minHeight = resources.getDimensionPixelSize(R.dimen.list_row_min_height)
            setOnClickListener { action() }
        }
        parent.addView(
            button,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = resources.getDimensionPixelSize(R.dimen.list_row_spacing) }
        )
    }

    private fun formatStatuses(statuses: Map<String, Int>): String =
        statuses.entries.sortedBy { it.key }.joinToString("  ·  ") { "${it.key}: ${it.value}" }
            .ifBlank { "No orders yet" }
}
