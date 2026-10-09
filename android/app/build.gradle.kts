plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.khroga.khroga"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        // TODO: Specify your own unique Application ID (https://developer.android.com/studio/build/application-id.html).
        applicationId = "com.khroga.khroga"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        // Uses the version code from pubspec.yaml. When using split APKs, 1000 * ABI_VERSION
        // is added automatically by Flutter. (https://developer.android.com/studio/build/configure-apk-splits#configure-APK-versions)
        // You can force using the value of versionCode by specifying the `-P force-version-code-ignoring-abi=true`
        // flag during build.
        versionCode = flutter.versionCode
        versionName = flutter.versionName
        // Our free website (Firebase Hosting). Links to it open the app
        // (App Links). The GitHub build sets it; test builds use a dummy.
        manifestPlaceholders["webHost"] = System.getenv("KHROGA_WEB_HOST")?.takeIf { it.isNotBlank() } ?: "khroga-not-connected.invalid"
    }

    // Two signing keys:
    // - The TEST key (committed) signs everyday builds, so Google sign-in
    //   works the same everywhere.
    // - The private RELEASE key signs Play Store builds. It is never in the
    //   project: the GitHub build writes it from the secret
    //   KHROGA_RELEASE_KEYSTORE and passes its password in
    //   KHROGA_RELEASE_PASSWORD (see SETUP.md, "Publishing").
    val releaseStore = System.getenv("KHROGA_RELEASE_STORE_FILE")
    val releasePassword = System.getenv("KHROGA_RELEASE_PASSWORD")
    val hasReleaseKey = !releaseStore.isNullOrEmpty() && !releasePassword.isNullOrEmpty() &&
        file(releaseStore).exists()

    signingConfigs {
        create("khrogaTest") {
            storeFile = file("khroga-test.keystore")
            storePassword = "khrogatest"
            keyAlias = "khroga"
            keyPassword = "khrogatest"
        }
        if (hasReleaseKey) {
            create("khrogaRelease") {
                storeFile = file(releaseStore!!)
                storePassword = releasePassword
                keyAlias = "khroga-release"
                keyPassword = releasePassword
            }
        }
    }

    buildTypes {
        debug {
            signingConfig = signingConfigs.getByName("khrogaTest")
        }
        release {
            signingConfig = signingConfigs.getByName(if (hasReleaseKey) "khrogaRelease" else "khrogaTest")
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
