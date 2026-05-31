import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Starting UI/UX Audit Recording...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordVideo: {
      dir: path.join(process.cwd(), 'output', 'video-audit'),
      size: { width: 1280, height: 720 },
    }
  });

  const page = await context.newPage();

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:5173');
    
    // Login
    console.log('Logging in as Course Leader...');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });
    await page.fill('input[name="username"]', 'devika.shetty');
    await page.fill('input[name="password"]', 'faculty1234');
    await page.click('button[type="submit"]');

    // Wait for Dashboard
    console.log('Waiting for Course Leader Dashboard to load...');
    await delay(3000); // Give it time to show loading states and render

    // Take screenshot to prove "Semester" is used instead of "Simulation"
    console.log('Verifying terminology (Semester vs Simulation)...');
    const content = await page.content();
    if (content.includes('Simulation')) {
      console.warn('WARNING: Found word "Simulation" on the dashboard.');
    }

    // Click on a student to view SHAP
    console.log('Opening a student card to verify SHAP breakdown...');
    // We will just click the first student row/card we find
    const studentLink = await page.locator('text=mnc_student').first();
    if (await studentLink.count() > 0) {
      await studentLink.click();
      await delay(2000);
      
      // Attempt to trigger risk re-evaluation to catch the animation
      console.log('Triggering Risk Re-evaluation...');
      const reevalBtn = await page.locator('button:has-text("Reevaluate")').first();
      if (await reevalBtn.count() > 0) {
        await reevalBtn.click();
        await delay(3000); // Wait for the animation to play out
      }
    } else {
      console.log('Could not find a student card easily, moving to HOD view.');
    }

    // Switch to HOD Role
    console.log('Switching to HOD View...');
    const roleSwitcher = await page.locator('button:has-text("Switch Role")').first();
    if (await roleSwitcher.count() > 0) {
      await roleSwitcher.click();
      const hodOption = await page.locator('text="HOD"').first();
      if (await hodOption.count() > 0) {
         await hodOption.click();
         await delay(3000);
         
         console.log('Opening Teacher Profile...');
         const teacherLink = await page.locator('text="Kavitha"').first();
         if (await teacherLink.count() > 0) {
            await teacherLink.click();
            await delay(3000);
         }
      }
    }

    console.log('Audit interaction complete. Closing browser to save video...');
  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await context.close();
    await browser.close();
    
    // Find the saved video and copy it to artifacts
    const videoDir = path.join(process.cwd(), 'output', 'video-audit');
    if (fs.existsSync(videoDir)) {
      const files = fs.readdirSync(videoDir);
      const webmFile = files.find(f => f.endsWith('.webm'));
      if (webmFile) {
        const dest = '/home/raed/.gemini/antigravity/brain/1a0f6fe9-78ed-4cee-8704-dd5fa397bbf9/ui-audit-recording.webm';
        fs.copyFileSync(path.join(videoDir, webmFile), dest);
        console.log(`Video successfully saved to artifacts: ${dest}`);
      }
    }
  }
}

run().catch(console.error);
