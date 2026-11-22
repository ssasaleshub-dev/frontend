package com.ssasaleshub.crm;

import android.content.Intent;
import android.os.Bundle;
import android.provider.Settings;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BiometricPlugin.class);
        super.onCreate(savedInstanceState);
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
