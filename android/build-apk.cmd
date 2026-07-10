@echo off
REM Собирает debug APK: web build -> cap sync android -> gradlew assembleDebug.
REM Использует JBR (JetBrains Runtime), который идёт в комплекте с уже установленной
REM Android Studio — отдельный JDK ставить не нужно, SDK уже стоит в %ANDROID_HOME%.
set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr
set ANDROID_HOME=C:\Users\Baron\AppData\Local\Android\Sdk
cd /d C:\Users\Baron\Downloads\my-app
call npm run build
call npx cap sync android
cd android
call gradlew.bat assembleDebug --console=plain
echo APK: android\app\build\outputs\apk\debug\app-debug.apk
