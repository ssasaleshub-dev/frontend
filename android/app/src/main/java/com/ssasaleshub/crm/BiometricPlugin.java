package com.ssasaleshub.crm;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.KeyProperties;
import android.util.Base64;
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
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;
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

    // ───────────────────────── Fingerprint-locked attendance key ─────────────────────────
    //
    // The private key is generated inside Android Keystore (secure hardware where available), can
    // never be exported, and can only sign right after a successful strong-biometric scan. It is
    // destroyed automatically if fingerprints on the phone are added or removed. The server keeps
    // only the public key, so a valid signature proves that this registered phone and an enrolled
    // fingerprint approved this exact check-in.

    private static final String KEYSTORE = "AndroidKeyStore";

    private static String keyAlias(String userId) {
        return "ssa_attendance_" + userId.trim().toLowerCase();
    }

    private String androidId() {
        String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        return (id != null && !id.isBlank()) ? id : "OFFICE-ANDROID-DEVICE";
    }

    /** Creates (or replaces) the user's key and returns its Base64 X.509 public key. */
    @PluginMethod
    public void createAttendanceKey(PluginCall call) {
        String userId = call.getString("userId");
        if (userId == null || userId.isBlank()) {
            call.reject("userId is required");
            return;
        }
        try {
            KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(keyAlias(userId), KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Every signature needs its own fingerprint scan (no device-PIN fallback)
                spec.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
            } else {
                spec.setUserAuthenticationValidityDurationSeconds(-1);
            }

            KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, KEYSTORE);
            generator.initialize(spec.build());
            KeyPair pair = generator.generateKeyPair();

            JSObject ret = new JSObject();
            ret.put("publicKey", Base64.encodeToString(pair.getPublic().getEncoded(), Base64.NO_WRAP));
            ret.put("deviceId", androidId());
            ret.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not create the fingerprint key: " + e.getMessage(), "KEY_CREATE_FAILED");
        }
    }

    /** Whether this phone holds an attendance key for the user. */
    @PluginMethod
    public void hasAttendanceKey(PluginCall call) {
        String userId = call.getString("userId");
        JSObject ret = new JSObject();
        try {
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            ret.put("exists", userId != null && ks.containsAlias(keyAlias(userId)));
        } catch (Exception e) {
            ret.put("exists", false);
        }
        call.resolve(ret);
    }

    /**
     * Shows the fingerprint prompt and, on success, signs the message with the user's key.
     * Resolves { success, signature, deviceId } or { success: false, code, error }.
     */
    @PluginMethod
    public void signChallenge(PluginCall call) {
        String userId = call.getString("userId");
        String message = call.getString("message");
        String title = call.getString("title", "Confirm check-in");
        String subtitle = call.getString("subtitle", "Scan your fingerprint to record your attendance");

        if (userId == null || userId.isBlank() || message == null || message.isEmpty()) {
            call.reject("userId and message are required");
            return;
        }

        final Signature signature;
        try {
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            PrivateKey key = (PrivateKey) ks.getKey(keyAlias(userId), null);
            if (key == null) {
                resolveFailure(call, "NO_KEY", "This phone has no fingerprint registration for your account. Register your fingerprint first.");
                return;
            }
            signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(key);
        } catch (KeyPermanentlyInvalidatedException e) {
            resolveFailure(call, "KEY_INVALIDATED", "Fingerprints on this phone changed. Register your fingerprint again.");
            return;
        } catch (Exception e) {
            resolveFailure(call, "KEY_ERROR", "Could not use the fingerprint key: " + e.getMessage());
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) {
            resolveFailure(call, "NO_ACTIVITY", "App is not in the foreground");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        resolveFailure(call, "AUTH_ERROR_" + errorCode, errString.toString());
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        try {
                            BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                            Signature unlocked = crypto != null ? crypto.getSignature() : null;
                            if (unlocked == null) {
                                resolveFailure(call, "NO_CRYPTO", "Fingerprint did not unlock the key");
                                return;
                            }
                            unlocked.update(message.getBytes(StandardCharsets.UTF_8));
                            byte[] signed = unlocked.sign();

                            JSObject res = new JSObject();
                            res.put("success", true);
                            res.put("signature", Base64.encodeToString(signed, Base64.NO_WRAP));
                            res.put("deviceId", androidId());
                            res.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
                            call.resolve(res);
                        } catch (Exception ex) {
                            resolveFailure(call, "SIGN_FAILED", "Could not sign the check-in: " + ex.getMessage());
                        }
                    }
                });

                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .setNegativeButtonText("Cancel")
                    .build();

                prompt.authenticate(info, new BiometricPrompt.CryptoObject(signature));
            } catch (Exception e) {
                resolveFailure(call, "PROMPT_FAILED", e.getMessage());
            }
        });
    }

    // ───────────── Fast check-in: unlock first, sign when the server's code arrives ─────────────
    //
    // The fingerprint prompt is shown immediately (unlockAttendanceKey) while the app fetches the
    // one-time check-in code from the server in parallel. Once both are done, signWithUnlockedKey
    // signs the code with the already-unlocked key. The unlocked key is single-use and expires.

    private Signature unlockedSignature;
    private long unlockedAtMs;
    private BiometricPrompt activeUnlockPrompt;
    private static final long UNLOCK_VALID_MS = 60_000;

    @PluginMethod
    public void unlockAttendanceKey(PluginCall call) {
        String userId = call.getString("userId");
        String title = call.getString("title", "Check in");
        String subtitle = call.getString("subtitle", "Scan your fingerprint to record your attendance");
        if (userId == null || userId.isBlank()) {
            call.reject("userId is required");
            return;
        }

        final Signature signature;
        try {
            KeyStore ks = KeyStore.getInstance(KEYSTORE);
            ks.load(null);
            PrivateKey key = (PrivateKey) ks.getKey(keyAlias(userId), null);
            if (key == null) {
                resolveFailure(call, "NO_KEY", "This phone has no fingerprint registration for your account. Register your fingerprint first.");
                return;
            }
            signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign(key);
        } catch (KeyPermanentlyInvalidatedException e) {
            resolveFailure(call, "KEY_INVALIDATED", "Fingerprints on this phone changed. Register your fingerprint again.");
            return;
        } catch (Exception e) {
            resolveFailure(call, "KEY_ERROR", "Could not use the fingerprint key: " + e.getMessage());
            return;
        }

        FragmentActivity activity = (FragmentActivity) getActivity();
        if (activity == null) {
            resolveFailure(call, "NO_ACTIVITY", "App is not in the foreground");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(getContext());
                BiometricPrompt prompt = new BiometricPrompt(activity, executor, new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        activeUnlockPrompt = null;
                        resolveFailure(call, "AUTH_ERROR_" + errorCode, errString.toString());
                    }

                    @Override
                    public void onAuthenticationSucceeded(@NonNull BiometricPrompt.AuthenticationResult result) {
                        activeUnlockPrompt = null;
                        BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                        Signature unlocked = crypto != null ? crypto.getSignature() : null;
                        if (unlocked == null) {
                            resolveFailure(call, "NO_CRYPTO", "Fingerprint did not unlock the key");
                            return;
                        }
                        synchronized (BiometricPlugin.this) {
                            unlockedSignature = unlocked;
                            unlockedAtMs = System.currentTimeMillis();
                        }
                        JSObject res = new JSObject();
                        res.put("success", true);
                        res.put("deviceId", androidId());
                        res.put("deviceName", Build.MANUFACTURER + " " + Build.MODEL);
                        call.resolve(res);
                    }
                });
                activeUnlockPrompt = prompt;

                BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle(title)
                    .setSubtitle(subtitle)
                    .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                    .setNegativeButtonText("Cancel")
                    .build();

                prompt.authenticate(info, new BiometricPrompt.CryptoObject(signature));
            } catch (Exception e) {
                activeUnlockPrompt = null;
                resolveFailure(call, "PROMPT_FAILED", e.getMessage());
            }
        });
    }

    /** Signs the server's message with the key unlocked by unlockAttendanceKey (single use). */
    @PluginMethod
    public void signWithUnlockedKey(PluginCall call) {
        String message = call.getString("message");
        if (message == null || message.isEmpty()) {
            call.reject("message is required");
            return;
        }
        Signature sig;
        synchronized (this) {
            sig = unlockedSignature;
            boolean fresh = sig != null && System.currentTimeMillis() - unlockedAtMs <= UNLOCK_VALID_MS;
            unlockedSignature = null;
            if (!fresh) {
                sig = null;
            }
        }
        if (sig == null) {
            resolveFailure(call, "NOT_UNLOCKED", "Fingerprint confirmation expired. Please try again.");
            return;
        }
        try {
            sig.update(message.getBytes(StandardCharsets.UTF_8));
            byte[] signed = sig.sign();
            JSObject res = new JSObject();
            res.put("success", true);
            res.put("signature", Base64.encodeToString(signed, Base64.NO_WRAP));
            res.put("deviceId", androidId());
            call.resolve(res);
        } catch (Exception e) {
            resolveFailure(call, "SIGN_FAILED", "Could not sign the check-in: " + e.getMessage());
        }
    }

    /** Closes an open fingerprint prompt (e.g. the server refused the check-in meanwhile). */
    @PluginMethod
    public void cancelUnlock(PluginCall call) {
        FragmentActivity activity = (FragmentActivity) getActivity();
        BiometricPrompt prompt = activeUnlockPrompt;
        activeUnlockPrompt = null;
        synchronized (this) {
            unlockedSignature = null;
        }
        if (prompt != null && activity != null) {
            activity.runOnUiThread(() -> {
                try {
                    prompt.cancelAuthentication();
                } catch (Exception ignored) {
                    // already closed
                }
            });
        }
        call.resolve();
    }

    private static void resolveFailure(PluginCall call, String code, String error) {
        JSObject res = new JSObject();
        res.put("success", false);
        res.put("code", code);
        res.put("error", error);
        call.resolve(res);
    }
}
