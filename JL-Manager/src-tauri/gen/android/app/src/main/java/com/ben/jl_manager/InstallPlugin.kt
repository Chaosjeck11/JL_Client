package com.ben.jl_manager

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import app.tauri.annotation.Command
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.Plugin
import java.io.File

@TauriPlugin
class InstallPlugin(private val activity: AppCompatActivity) : Plugin(activity) {

    @Command
    fun installApk(invoke: Invoke) {
        val path: String? = invoke.data.getString("path")
        if (path == null) {
            invoke.reject("path is required")
            return
        }
        val file = File(path)
        if (!file.exists()) {
            invoke.reject("APK not found: $path")
            return
        }
        try {
            val uri = FileProvider.getUriForFile(
                activity,
                "${activity.packageName}.fileprovider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            activity.startActivity(intent)
            invoke.resolve()
        } catch (e: Exception) {
            invoke.reject("Installer error: ${e.message}")
        }
    }
}
