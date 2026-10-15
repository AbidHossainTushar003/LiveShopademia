import java.net.URI

plugins {
    id("com.android.application")
}

fun quoteBuildConfig(value: String): String = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\""

fun validateApiBaseUrl(value: String, release: Boolean) {
    val uri = URI(value)
    require((uri.isAbsolute) && (uri.host != null) && (uri.path.endsWith("/"))) {
        "API base URLs must be absolute URLs with a host and trailing /"
    }
    require(uri.rawUserInfo == null && uri.rawQuery == null && uri.rawFragment == null) {
        "API base URLs cannot include credentials, query parameters, or fragments"
    }
    require(uri.scheme == "https" || (!release && uri.scheme == "http" && uri.host in setOf("127.0.0.1", "localhost"))) {
        "Release API URLs must use HTTPS; debug HTTP is allowed only for loopback"
    }
}

val debugApiBaseUrl = providers.gradleProperty("shopademiaApiBaseUrl")
    .orElse("http://127.0.0.1:3002/api/v1/")
    .get()
val releaseApiBaseUrl = providers.gradleProperty("shopademiaReleaseApiBaseUrl")
    .orElse("https://api.shopademia.store/api/v1/")
    .get()

validateApiBaseUrl(debugApiBaseUrl, release = false)
validateApiBaseUrl(releaseApiBaseUrl, release = true)

android {
    namespace = "com.shopademia.admin"
    compileSdk = 37

    defaultConfig {
        applicationId = "com.shopademia.admin"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "1.0.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        buildConfigField("String", "API_BASE_URL", quoteBuildConfig(debugApiBaseUrl))
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            buildConfigField("String", "API_BASE_URL", quoteBuildConfig(debugApiBaseUrl))
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            buildConfigField("String", "API_BASE_URL", quoteBuildConfig(releaseApiBaseUrl))
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.appcompat:appcompat:1.7.1")
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-ktx:2.9.4")
    implementation("com.google.android.material:material:1.13.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.google.code.gson:gson:2.11.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.10.2")
    testImplementation("com.squareup.okhttp3:mockwebserver:4.12.0")
    testImplementation("androidx.test:core:1.7.0")

    androidTestImplementation("androidx.test:runner:1.7.0")
    androidTestImplementation("androidx.test:rules:1.7.0")
    androidTestImplementation("androidx.test:core-ktx:1.7.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
}
