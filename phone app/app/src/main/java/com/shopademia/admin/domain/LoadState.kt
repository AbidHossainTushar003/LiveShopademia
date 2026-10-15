package com.shopademia.admin.domain

sealed interface LoadState<out T> {
    data object Idle : LoadState<Nothing>
    data object Loading : LoadState<Nothing>
    data class Content<T>(val value: T) : LoadState<T>
    data object Empty : LoadState<Nothing>
    data class Failure(val error: AppError) : LoadState<Nothing>
}

fun <T> LoadState<T>.contentOrNull(): T? {
    val content = this as? LoadState.Content<*> ?: return null
    @Suppress("UNCHECKED_CAST")
    return content.value as T
}
