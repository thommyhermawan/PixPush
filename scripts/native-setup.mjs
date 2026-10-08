// Patches the generated Android/iOS projects: AdMob app ID, version, portrait lock, release signing.
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const cfg = pkg.pixpush;
const version = pkg.version;
const code = String(process.env.PIX_VERSION_CODE || cfg.versionCode);

function patch(file, fn) {
  if (!fs.existsSync(file)) return false;
  const before = fs.readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) fs.writeFileSync(file, after);
  return true;
}

/* ---------- Android ---------- */
const manifest = path.join(root, 'android/app/src/main/AndroidManifest.xml');
if (patch(manifest, s => {
  if (!s.includes('com.google.android.gms.ads.APPLICATION_ID')) {
    s = s.replace(/<application([^>]*)>/, `<application$1>\n        <meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="${cfg.admobAppIdAndroid}"/>`);
  }
  s = s.replace(/android:configChanges="([^"]*)"/, (m, v) => v.includes('density') ? m : `android:configChanges="${v}|density"`);
  if (!s.includes('android:screenOrientation')) s = s.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
  return s;
})) console.log('android manifest patched');

const gradle = path.join(root, 'android/app/build.gradle');
if (patch(gradle, s => {
  s = s.replace(/versionCode\s+\d+/, `versionCode ${code}`).replace(/versionName\s+"[^"]*"/, `versionName "${version}"`);
  if (!s.includes('PIX_KEYSTORE')) {
    s = s.replace(/android\s*\{/, `android {
    signingConfigs {
        release {
            if (System.getenv("PIX_KEYSTORE")) {
                storeFile file(System.getenv("PIX_KEYSTORE"))
                storePassword System.getenv("PIX_KEYSTORE_PASSWORD")
                keyAlias System.getenv("PIX_KEY_ALIAS")
                keyPassword System.getenv("PIX_KEY_PASSWORD")
            }
        }
    }`);
    s = s.replace(/buildTypes\s*\{\s*release\s*\{/, `buildTypes {
        release {
            if (System.getenv("PIX_KEYSTORE")) { signingConfig signingConfigs.release }`);
  }
  return s;
})) console.log('android gradle patched');

/* ---------- iOS ---------- */
const plist = path.join(root, 'ios/App/App/Info.plist');
if (patch(plist, s => {
  const add = (key, xml) => { if (!s.includes(`<key>${key}</key>`)) s = s.replace(/<\/dict>\s*<\/plist>\s*$/, `\t<key>${key}</key>\n\t${xml}\n</dict>\n</plist>\n`); };
  add('GADApplicationIdentifier', `<string>${cfg.admobAppIdIos}</string>`);
  add('NSUserTrackingUsageDescription', `<string>${cfg.trackingText}</string>`);
  add('ITSAppUsesNonExemptEncryption', '<false/>');
  add('SKAdNetworkItems', '<array>\n\t\t<dict><key>SKAdNetworkIdentifier</key><string>cstr6suwn9.skadnetwork</string></dict>\n\t</array>');
  // portrait only on iPhone
  s = s.replace(/(<key>UISupportedInterfaceOrientations<\/key>\s*<array>)[\s\S]*?(<\/array>)/, '$1\n\t\t<string>UIInterfaceOrientationPortrait</string>\n\t$2');
  return s;
})) console.log('ios plist patched');

const pbx = path.join(root, 'ios/App/App.xcodeproj/project.pbxproj');
if (patch(pbx, s => s
  .replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${version};`)
  .replace(/CURRENT_PROJECT_VERSION = [^;]+;/g, `CURRENT_PROJECT_VERSION = ${code};`)
  .replace(/TARGETED_DEVICE_FAMILY = [^;]+;/g, 'TARGETED_DEVICE_FAMILY = 1;')
  .replace(/(DEVELOPMENT_TEAM = )[^;]*;/g, process.env.PIX_APPLE_TEAM_ID ? `$1${process.env.PIX_APPLE_TEAM_ID};` : '$&')
)) console.log('ios project patched');
