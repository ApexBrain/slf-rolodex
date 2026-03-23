# Foundational UI Design Guide: Dark Theme SLF Rolodex@

### 1. Colors and Usage

This UI relies on a high-contrast dark theme with a punchy, energetic accent color.

* **Main Background (App Base):** **Deep Obsidian / Almost Black** (approx. `#111312`)
    * *Usage:* The main background canvas of the entire app. It makes the brighter elements pop.
* **Primary Accent:** **Vibrant Lime Green / Chartreuse** (approx. `#C8F826`)
    * *Usage:* Highlighting crucial information, primary action buttons, and active state icons. It drives the user's eye to the most important actions.
* **Container/Surface Background:** **Dark Slate / Olive Grey** (approx. `#212621`)
    * *Usage:* Used for secondary cards, grid cards, and list items. It visually separates grouped information from the pure black background without being too bright.
* **Primary Text:** **Pure White** (`#FFFFFF`)
    * *Usage:* Main headings, primary numbers, and active button text.
* **Secondary Text:** **Muted Grey** (approx. `#A0A5A0`)
    * *Usage:* Subtitles, labels, dates, and minor details.

### 2. Fonts and Usage

The typography is a clean, modern, and highly legible geometric sans-serif (similar to **SF Pro Display, Inter, or Satoshi**).

* **Display / Large Headings:** * *Style:* Bold or Semi-Bold, large size (approx. 28pt–34pt).
    * *Usage:* Anchors the page and immediately delivers the most important data or greeting.
* **Section Headers:** * *Style:* Medium weight, medium size (approx. 16pt–18pt).
    * *Usage:* Clearly divides the screen into distinct functional areas.
* **Body / List Text:** * *Style:* Regular weight, standard size (approx. 14pt–15pt).
    * *Usage:* Standard readable text for list items.
* **Small Labels / Microcopy:** * *Style:* Regular weight, small size (approx. 11pt–12pt), almost always paired with the **Muted Grey** color.
    * *Usage:* Contextual information that shouldn't distract from the main numbers.

### 3. Information Containers (Shapes & Layout)

The UI relies heavily on "softness" through rounded corners, contrasting with the stark color palette.

* **Main Hero Cards:**
    * *Shape:* Large rectangles with significant corner rounding (**approx. 24px–32px border radius**).
    * *Details:* These take up the full width of the screen (minus standard side margins). The primary card features an inner, lighter-colored vertical slice on the right side for secondary icons, creating a dynamic layout within the card.
* **Grid Cards:**
    * *Shape:* Squarish rectangles arranged in a 2-column grid. Same heavy rounding (**approx. 20px–24px border radius**).
    * *Details:* These group an icon, title, subtitle, and an amount.
* **List Items:**
    * *Shape:* Horizontal bars/rows inside a larger container, or standalone rounded rectangles.
* **Buttons & Avatars:**
    * *Shape:* Extreme rounding. Avatars and icon buttons are **perfect circles**. Call-to-action buttons are **pill-shaped** (fully rounded ends).
* **Floating Navigation Bar (Bottom):**
    * *Shape:* A floating pill-shaped island at the bottom of the screen, housing circular icons. It detaches from the very bottom edge of the screen, enhancing the modern, layered feel.