package com.shopademia.admin.domain

import com.google.gson.JsonParser
import java.io.IOException
import retrofit2.HttpException

sealed class AppError(open val message: String, open val requestId: String? = null) {
    data class Unauthorized(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class Forbidden(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class NotFound(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class Validation(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class Conflict(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class RateLimited(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class PayloadTooLarge(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class Network(override val message: String) : AppError(message)

    data class Server(override val message: String, override val requestId: String? = null) :
        AppError(message, requestId)

    data class Unexpected(override val message: String) : AppError(message)
}

object ApiErrorMapper {
    fun from(error: Throwable): AppError = when (error) {
        is HttpException -> fromHttp(error)
        is IOException -> AppError.Network("Could not reach the Shopademia API. Check your connection and try again.")
        is IllegalStateException -> AppError.Unexpected(error.message ?: "The saved session is unavailable.")
        else -> AppError.Unexpected("The request could not be completed. Please try again.")
    }

    private fun fromHttp(error: HttpException): AppError {
        val response = error.response()
        val status = error.code()
        val requestId = response?.headers()?.get("X-Request-Id")
        val serverMessage = response?.errorBody()?.use { body ->
            runCatching {
                val json = JsonParser.parseString(body.string())
                json.takeIf { it.isJsonObject }
                    ?.asJsonObject
                    ?.get("error")
                    ?.takeIf { it.isJsonPrimitive && it.asJsonPrimitive.isString }
                    ?.asString
            }.getOrNull()
        }
        val message = serverMessage ?: when (status) {
            400 -> "The request was not accepted. Check the entered information."
            401 -> "Your session has expired or the sign-in details were rejected."
            403 -> "This account is not allowed to perform this action."
            404 -> "The requested record could not be found."
            409 -> "The request conflicts with the current server state."
            413 -> "The submitted content is too large."
            429 -> "Too many attempts. Wait a moment and try again."
            else -> "The server could not complete the request."
        }
        val diagnostic = requestId?.takeIf { it.length <= 64 }?.let { " (Request ID: $it)" }.orEmpty()
        val safeMessage = message + diagnostic
        return when (status) {
            400 -> AppError.Validation(safeMessage, requestId)
            401 -> AppError.Unauthorized(safeMessage, requestId)
            403 -> AppError.Forbidden(safeMessage, requestId)
            404 -> AppError.NotFound(safeMessage, requestId)
            409 -> AppError.Conflict(safeMessage, requestId)
            413 -> AppError.PayloadTooLarge(safeMessage, requestId)
            429 -> AppError.RateLimited(safeMessage, requestId)
            in 500..599 -> AppError.Server(safeMessage, requestId)
            else -> AppError.Unexpected(safeMessage)
        }
    }
}
