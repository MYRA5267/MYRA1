package app.myra.music;

import android.Manifest;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "MyraMedia",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class MyraMediaPlugin extends Plugin {
    private BroadcastReceiver commandReceiver;

    @Override
    public void load() {
        commandReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                if (MyraPlaybackService.BROADCAST_ERROR.equals(intent.getAction())) {
                    JSObject error = new JSObject();
                    error.put("message", intent.getStringExtra(MyraPlaybackService.EXTRA_MESSAGE));
                    notifyListeners("mediaError", error, true);
                    return;
                }
                JSObject event = new JSObject();
                event.put("command", intent.getStringExtra(MyraPlaybackService.EXTRA_COMMAND));
                if (intent.hasExtra(MyraPlaybackService.EXTRA_POSITION)) {
                    event.put("position", intent.getDoubleExtra(MyraPlaybackService.EXTRA_POSITION, 0));
                }
                notifyListeners("mediaCommand", event, true);
            }
        };
        IntentFilter filter = new IntentFilter(MyraPlaybackService.BROADCAST_COMMAND);
        filter.addAction(MyraPlaybackService.BROADCAST_ERROR);
        ContextCompat.registerReceiver(
            getContext(),
            commandReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void update(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MyraPlaybackService.class);
            intent.setAction(MyraPlaybackService.ACTION_UPDATE);
            intent.putExtra(MyraPlaybackService.EXTRA_ID, call.getString("id", ""));
            intent.putExtra(MyraPlaybackService.EXTRA_TITLE, call.getString("title", "MYRA"));
            intent.putExtra(MyraPlaybackService.EXTRA_ARTIST, call.getString("artist", ""));
            intent.putExtra(MyraPlaybackService.EXTRA_ALBUM, call.getString("album", ""));
            intent.putExtra(MyraPlaybackService.EXTRA_ARTWORK, call.getString("artwork", ""));
            intent.putExtra(MyraPlaybackService.EXTRA_PLAYING, call.getBoolean("playing", false));
            intent.putExtra(MyraPlaybackService.EXTRA_LIKED, call.getBoolean("liked", false));
            intent.putExtra(MyraPlaybackService.EXTRA_DURATION, call.getDouble("duration", 0.0));
            intent.putExtra(MyraPlaybackService.EXTRA_POSITION, call.getDouble("position", 0.0));

            // Always enter through startForegroundService. The service posts
            // its media notification immediately for both PLAYING and PAUSED,
            // so OEM power management cannot silently demote it after pause.
            ContextCompat.startForegroundService(getContext(), intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Android не разрешил запустить системный медиаплеер", error);
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            Intent intent = new Intent(getContext(), MyraPlaybackService.class);
            intent.setAction(MyraPlaybackService.ACTION_STOP);
            getContext().startService(intent);
            call.resolve();
        } catch (Exception error) {
            call.reject("Не удалось остановить системный медиаплеер", error);
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (commandReceiver != null) {
            try {
                getContext().unregisterReceiver(commandReceiver);
            } catch (IllegalArgumentException ignored) {
                // Receiver was already unregistered by the activity lifecycle.
            }
            commandReceiver = null;
        }
    }
}
