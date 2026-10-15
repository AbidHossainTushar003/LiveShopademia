package com.shopademia.admin.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

interface TokenStore {
    fun read(): String?
    fun write(token: String)
    fun clear()
}

class AndroidKeystoreTokenStore(context: Context) : TokenStore {
    private val preferences = context.applicationContext
        .getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    override fun read(): String? {
        val stored = preferences.getString(TOKEN_KEY, null) ?: return null
        try {
            val payload = Base64.decode(stored, Base64.NO_WRAP)
            require(payload.size > GCM_IV_SIZE) { "Stored session token is malformed." }
            val iv = payload.copyOfRange(0, GCM_IV_SIZE)
            val ciphertext = payload.copyOfRange(GCM_IV_SIZE, payload.size)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            return cipher.doFinal(ciphertext).toString(Charsets.UTF_8).also {
                require(it.isNotBlank()) { "Stored session token is empty." }
            }
        } catch (error: Exception) {
            clear()
            throw IllegalStateException("The saved admin session could not be unlocked. Sign in again.", error)
        }
    }

    override fun write(token: String) {
        require(token.isNotBlank()) { "A non-empty session token is required." }
        try {
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.ENCRYPT_MODE, encryptionKey())
            val encrypted = cipher.doFinal(token.toByteArray(Charsets.UTF_8))
            val payload = cipher.iv + encrypted
            val saved = preferences.edit()
                .putString(TOKEN_KEY, Base64.encodeToString(payload, Base64.NO_WRAP))
                .commit()
            check(saved) { "Could not persist the protected admin session." }
        } catch (error: Exception) {
            throw IllegalStateException("Could not protect the admin session on this device.", error)
        }
    }

    override fun clear() {
        check(preferences.edit().remove(TOKEN_KEY).commit()) {
            "Could not clear the saved admin session."
        }
    }

    @Synchronized
    private fun encryptionKey(): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEY_STORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, ANDROID_KEY_STORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .setRandomizedEncryptionRequired(true)
                .build()
        )
        return generator.generateKey()
    }

    private companion object {
        const val ANDROID_KEY_STORE = "AndroidKeyStore"
        const val KEY_ALIAS = "shopademia.admin.session.v1"
        const val PREFERENCES_NAME = "protected_admin_session"
        const val TOKEN_KEY = "encrypted_bearer_token"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_IV_SIZE = 12
        const val GCM_TAG_BITS = 128
    }
}
