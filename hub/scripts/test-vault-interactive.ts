import { createiOSSimulatorBridge } from '../src/agents/testing/ios-simulator-bridge';

const bridge = createiOSSimulatorBridge('./storage/ios-test-screenshots');

async function runTest() {
  console.log('🧪 Interactive Vault iOS Test\n');
  
  const device = bridge.getBootedSimulator();
  if (!device) {
    console.error('No simulator booted');
    process.exit(1);
  }
  console.log(`📱 Device: ${device.name}`);
  
  // Launch app fresh
  await bridge.terminateApp('com.jdagent.vault');
  await new Promise(r => setTimeout(r, 500));
  await bridge.launchApp('com.jdagent.vault');
  await new Promise(r => setTimeout(r, 2000));
  
  // Take screenshot of home screen
  console.log('\n1️⃣ Taking screenshot of home screen...');
  const homeScreenshot = await bridge.takeScreenshot('interactive-home.png');
  console.log(`   Screenshot saved: ${homeScreenshot.path}`);
  
  // The "New Note" button is in Quick Actions around y=310
  console.log('\n2️⃣ Tapping "New Note" button...');
  await bridge.tap(130, 310);
  await new Promise(r => setTimeout(r, 2000));
  
  // Take screenshot after tap
  const afterTapScreenshot = await bridge.takeScreenshot('interactive-after-tap.png');
  console.log(`   Screenshot saved: ${afterTapScreenshot.path}`);
  
  // Try typing something
  console.log('\n3️⃣ Attempting to type title...');
  await bridge.typeText('Test Note from iOS Agent');
  await new Promise(r => setTimeout(r, 1000));
  
  const afterTypeScreenshot = await bridge.takeScreenshot('interactive-after-type.png');
  console.log(`   Screenshot saved: ${afterTypeScreenshot.path}`);
  
  console.log('\n✅ Interactive test complete');
  console.log('   Check screenshots at: hub/storage/ios-test-screenshots/');
}

runTest().catch(console.error);
