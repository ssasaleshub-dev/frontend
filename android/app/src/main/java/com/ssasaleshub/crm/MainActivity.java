package com.ssasaleshub.crm;

import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.View;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BiometricPlugin.class);
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.getDecorView().setBackgroundColor(Color.WHITE);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(true);
            controller.setAppearanceLightNavigationBars(true);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowCompat.setDecorFitsSystemWindows(window, false);
            View content = findViewById(android.R.id.content);
            if (content != null) {
                ViewCompat.setOnApplyWindowInsetsListener(content, (v, windowInsets) -> {
                    Insets systemInsets = windowInsets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    Insets imeInsets = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
                    boolean keyboardVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
                    int bottom = keyboardVisible ? Math.max(systemInsets.bottom, imeInsets.bottom) : systemInsets.bottom;
                    v.setPadding(systemInsets.left, systemInsets.top, systemInsets.right, bottom);
                    return new WindowInsetsCompat.Builder(windowInsets)
                        .setInsets(
                            WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout() | WindowInsetsCompat.Type.ime(),
                            Insets.of(0, 0, 0, 0)
                        )
                        .build();
                });
                ViewCompat.requestApplyInsets(content);
            }
        } else {
            window.setStatusBarColor(Color.WHITE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                window.setNavigationBarColor(Color.WHITE);
            }
        }
    }

    @Override
    public void startActivityForResult(Intent intent, int requestCode) {
        if (isExactAlarmIntent(intent)) {
            return;
        }
        super.startActivityForResult(intent, requestCode);
    }

    @Override
    public void startActivityForResult(Intent intent, int requestCode, Bundle options) {
        if (isExactAlarmIntent(intent)) {
            return;
        }
        super.startActivityForResult(intent, requestCode, options);
    }

    @Override
    public void startActivity(Intent intent) {
        if (isExactAlarmIntent(intent)) {
            return;
        }
        super.startActivity(intent);
    }

    @Override
    public void startActivity(Intent intent, Bundle options) {
        if (isExactAlarmIntent(intent)) {
            return;
        }
        super.startActivity(intent, options);
    }

    private boolean isExactAlarmIntent(Intent intent) {
        if (intent == null) return false;
        String action = intent.getAction();
        if (action == null) return false;
        return action.equals(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM)
            || action.equals("android.settings.REQUEST_SCHEDULE_EXACT_ALARM");
    }
}
