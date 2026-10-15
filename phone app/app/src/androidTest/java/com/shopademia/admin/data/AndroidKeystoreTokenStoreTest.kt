package com.shopademia.admin.data

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.Context
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AndroidKeystoreTokenStoreTest {
    @Test
    fun tokenIsEncryptedAtRestAndCanBeCleared() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        context.getSharedPreferences("protected_admin_session", Context.MODE_PRIVATE)
            .edit()
            .clear()
            .commit()
        val store = AndroidKeystoreTokenStore(context)
        val token = "synthetic-test-bearer-token"

        store.write(token)

        val storedValue = context.getSharedPreferences("protected_admin_session", Context.MODE_PRIVATE)
            .getString("encrypted_bearer_token", null)
        assertFalse(storedValue == token)
        assertEquals(token, store.read())
        store.clear()
        assertNull(store.read())
    }
}
