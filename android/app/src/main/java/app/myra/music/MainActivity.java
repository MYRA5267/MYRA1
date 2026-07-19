package app.myra.music;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(MyraMediaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
