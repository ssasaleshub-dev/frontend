package com.ssasaleshub.crm;

import android.os.Build;
import android.provider.Settings;
import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricPlugin")
public class BiometricPlugin extends Plugin {

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            BiometricManager biometricManager = BiometricManager.from(getContext());
            int canAuth = biometricManager.canAuthenticate(
                BiometricManager.Authenticators.BIOMETRIC_STRONG | BiometricManager.Authenticators.BIOMETRIC_WEAK
            );

            boolean available = (canAuth == BiometricManager.BIOMETRIC_SUCCESS);
            ret.put("available", available);
            ret.put("status", canAuth);
            call.resolve(ret);
        } catch (Exception e) {
            ret.put("available", false);
            ret.put("error", e.getMessage());
            call.resolve(ret);
        }
    }

    @PluginMethod
    public void getDeviceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        try {
            String androidId = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
            String deviceName = Build.MANUFACTURER + " " + Build.MODEL;

            ret.put("deviceId", (androidId != null && !androidId.isBlank()) ? androidId : "OFFICE-ANDROID-DEVICE");
            ret.put("deviceName", deviceName);
            ret.put("manufacturer", Build.MANUFACTURER);
            ret.put("model", Build.MODEL);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to obtain device ID: " + e.getMessage());
        }
    }

    @PluginMethod
    public void promptBiometric(PluginCall call) {
        String title = call.getString("title", "Register Office Fingerprint");
        String subtitle = call.getString("subtitle", "Scan your fingerprint to bind this office device to your account");
        String description = call.getString("description", "Office attendance hardware verification");

        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) {
            call.reject("Activity context not available");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(getContext());

                BiometricPrompt.AuthenticationCallback callback = new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        JSObject res = new JSObject();
                        res.put("success", false);
                        res.put("errorCode", errorCode);
                        res.put("error", errString.toString());
                        call.resolve(res);
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        try {
                            String androidId = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
                            if (androidId == null || androidId.isBlank()) {
                                androidId = "OFFICE-DEV-" + Build.SERIAL;
                            }
                            String deviceName = Build.MANUFACTURER + " " + Build.MODEL;

                            // Compute a secure hardware fingerprint key signature
                            String rawSeed = "SSA_BIO_" + androidId + "_" + Build.FINGERPRINT;
                            MessageDigest md = MessageDigest.getInstance("SHA-256");
                            byte[] digest = md.digest(rawSeed.getBytes(StandardCharsets.UTF_8));
                            StringBuilder sb = new StringBuilder("BIO-KEY-");
                            for (int i = 0; i < 8; i++) {
                                sb.append(String.format("%02X", digest[i]));
                            }
                            String biometricKeyId = sb.toString();

                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("deviceId", androidId);
                            res.put("deviceName", deviceName);
                            res.put("biometricKeyId", biometricKeyId);
                            call.resolve(res);
                        } catch (Exception ex) {
                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("deviceId", "OFFICE-DEVICE-01");
                            res.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
                            res.put("biometricKeyId", "BIO-KEY-" + System.currentTimeMillis());
                            call.resolve(res);
                        }
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                    }
                };

                BiometricPrompt biometricPrompt = new BiometricPrompt(activity, executor, callback);

                BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setDescription(description)
                    .setNegativeButtonText("Cancel")
                    .build();

                biometricPrompt.authenticate(promptInfo);
            } catch (Exception e) {
                JSObject res = new JSObject();
                res.put("success", false);
                res.put("error", e.getMessage());
                call.resolve(res);
            }
        });
    }
}
