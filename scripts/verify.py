from playwright.sync_api import Page, expect, sync_playwright

def verify_sprite_change(page: Page):
  """
  This script verifies that the airplane sprite has been updated.
  """
  # 1. Navigate to the game.
  page.goto("http://localhost:3000")

  # 2. Click the start button to load the game.
  start_button = page.get_by_role("button", name="Start")
  expect(start_button).to_be_visible(timeout=30000)
  start_button.click()

  # 3. Wait for the game canvas to be visible.
  canvas = page.locator("canvas").first
  expect(canvas).to_be_visible(timeout=30000)

  # 4. Select the airport tool
  airport_tool = page.get_by_role("button", name="Airport")
  expect(airport_tool).to_be_visible()
  airport_tool.click()

  # 5. Place the airport on the map
  canvas.click(position={"x": 500, "y": 300})

  # 6. Take a screenshot.
  page.screenshot(path="/home/jules/verification/verification.png")

if __name__ == "__main__":
  with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
      verify_sprite_change(page)
    finally:
      browser.close()
