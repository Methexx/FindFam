allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// sentry_flutter 8.14.2 pins `languageVersion = "1.6"` in its own
// android/build.gradle. Kotlin 2.2's compiler rejects anything below 1.8
// outright ("Language version 1.6 is no longer supported"), so the plugin
// fails to compile and takes the whole debug build with it.
//
// It is the only plugin in the tree that does this — checked across every
// android/build.gradle in the pub cache — and nothing in its source actually
// needs a 1.6 language level; the pin is leftover compatibility baggage from
// when it supported much older Gradle plugins.
//
// So raise the floor to 1.8 wherever a subproject asks for less, rather than
// pinning the app's own Kotlin backwards for one dependency or taking the
// sentry_flutter 9.x major bump on the crash reporter. Modules that don't set
// a language version at all — ours included — have no value to compare and are
// left on the plugin default, untouched.
//
// Remove this once sentry_flutter drops the pin.
subprojects {
    tasks.withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile>().configureEach {
        compilerOptions {
            val floor = org.jetbrains.kotlin.gradle.dsl.KotlinVersion.KOTLIN_1_8
            if ((languageVersion.orNull ?: floor) < floor) languageVersion.set(floor)
            if ((apiVersion.orNull ?: floor) < floor) apiVersion.set(floor)
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
