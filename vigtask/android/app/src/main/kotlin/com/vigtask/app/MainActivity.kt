package com.vigtask.app

import android.app.Activity
import android.content.Intent
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.vigtask.app/file_picker"
    private var pendingResult: MethodChannel.Result? = null
    private val FILE_PICK_REQUEST = 1001

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            if (call.method == "pickFile") {
                val allowMultiple = call.argument<Boolean>("allowMultiple") ?: false
                pendingResult = result
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
                }
                startActivityForResult(Intent.createChooser(intent, "Select File"), FILE_PICK_REQUEST)
            } else {
                result.notImplemented()
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == FILE_PICK_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null) {
                val uris = mutableListOf<String>()
                val clipData = data.clipData
                if (clipData != null) {
                    for (i in 0 until clipData.itemCount) {
                        uris.add(clipData.getItemAt(i).uri.toString())
                    }
                } else if (data.data != null) {
                    uris.add(data.data!!.toString())
                }
                pendingResult?.success(uris)
            } else {
                pendingResult?.success(emptyList<String>())
            }
            pendingResult = null
        }
    }
}
