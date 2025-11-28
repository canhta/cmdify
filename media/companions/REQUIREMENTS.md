# Animated Companion SVG Requirements

## Project Overview

Create 16 animated SVG files for a Pomodoro focus timer VS Code extension. Each companion (cat, robot, plant, flame) needs 4 separate state-based SVG files with embedded CSS animations that loop continuously.

**File Structure:**
```
media/companions/
├── cat-idle.svg
├── cat-focus.svg
├── cat-break.svg
├── cat-celebrate.svg
├── robot-idle.svg
├── robot-focus.svg
├── robot-break.svg
├── robot-celebrate.svg
├── plant-idle.svg
├── plant-focus.svg
├── plant-break.svg
├── plant-celebrate.svg
├── flame-idle.svg
├── flame-focus.svg
├── flame-break.svg
└── flame-celebrate.svg
```

---

## Technical Specifications

### SVG Canvas
- **ViewBox**: `0 0 64 64`
- **Width/Height**: Do not set explicit width/height (let CSS control size)
- **Display Size**: Will be rendered at 56x56 pixels in the UI

### SVG Template Structure
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <style>
    /* CSS animations MUST be inside the SVG */
    /* All animations must use "infinite" to loop continuously */
  </style>
  
  <defs>
    <!-- Gradients, filters, clip paths here if needed -->
  </defs>
  
  <!-- Main content elements -->
</svg>
```

### Animation Requirements
1. **CSS Only**: Use `<style>` inside SVG - NO JavaScript
2. **Infinite Loop**: Every animation MUST have `animation: name Xs infinite`
3. **Smooth Transitions**: Use `ease-in-out` for organic feel
4. **Auto-play**: Animations start immediately on load
5. **No User Interaction**: These are `<img>` tags, not inline SVG

### Color Palette
Use these exact colors for consistency:

| Element | Color | Usage |
|---------|-------|-------|
| Primary Body | `#4a4a4a` | Main character outline/fill |
| Secondary | `#6b6b6b` | Shading, secondary elements |
| Highlight | `#ffffff` | Eyes shine, sparkles |
| Blush/Warmth | `#ffb4b4` | Cheeks, warm accents |
| Focus Glow | `#ffa500` | Orange glow for focus state |
| Break Glow | `#4ecdc4` | Teal/mint for relaxation |
| Celebrate | `#ffd700` | Gold for celebration |
| Sparkle | `#fff9c4` | Light yellow sparkles |

### Animation Timing by State

| State | Loop Duration | Easing | Energy Level |
|-------|--------------|--------|--------------|
| idle | 3-4 seconds | ease-in-out | Low, calm |
| focus | 1.5-2 seconds | ease-in-out | Medium, steady |
| break | 2.5-3 seconds | ease-in-out | Low, relaxed |
| celebrate | 0.8-1.2 seconds | ease-out | High, bouncy |

---

## Companion 1: Cat 🐱

A cute, round cat with expressive eyes and a swaying tail.

### Base Design
- **Shape**: Round body (circle-ish, ~40px diameter)
- **Position**: Centered, sitting on bottom edge
- **Head**: Large round head with pointed ears
- **Eyes**: Large oval eyes with white highlights (pupils look alive)
- **Ears**: Two triangular ears, slightly angled outward
- **Tail**: Curved tail extending from back right side
- **Whiskers**: 3 thin lines on each side of face
- **Expression**: Small "w" or curved mouth

### cat-idle.svg
**Mood**: Relaxed, content, waiting
**Animations Required**:
1. **Tail Sway**: Tail swings left-right slowly
   - `transform-origin` at tail base
   - Rotate from -15deg to +15deg
   - Duration: 3s
2. **Gentle Breathing**: Body scales slightly up/down
   - Scale from 1.0 to 1.02
   - Duration: 3.5s
3. **Slow Blink**: Eyes close briefly every few seconds
   - Scale Y from 1 to 0.1 (squish)
   - Hold closed briefly
   - Duration: 4s (with long pause before blink)

**Visual Details**:
- Eyes half-lidded, relaxed
- Ears in neutral position
- Small content smile

### cat-focus.svg
**Mood**: Alert, determined, concentrating
**Animations Required**:
1. **Ear Twitch**: Ears rotate slightly, alternating
   - Left ear twitches, then right
   - Rotate 5-10deg
   - Duration: 2s
2. **Eye Shimmer**: Pupils have subtle size pulse
   - Scale 1.0 to 1.1
   - Creates "thinking" effect
   - Duration: 1.5s
3. **Focused Breathing**: Faster, shallower breathing
   - Scale 1.0 to 1.015
   - Duration: 1.5s
4. **Tail Tension**: Tail held higher, slight vibration
   - Small rapid movement
   - Duration: 0.5s

**Visual Details**:
- Eyes wide open, alert
- Pupils slightly dilated
- Ears perked forward
- Orange/yellow glow aura around cat (subtle)
- More upright posture

### cat-break.svg
**Mood**: Sleepy, stretching, relaxed
**Animations Required**:
1. **Big Yawn**: Mouth opens wide, then closes
   - Mouth scales up, eyes squint
   - Duration: 3s
2. **Stretch**: Body elongates forward
   - Transform scaleX or translateX forward slightly
   - Front paws extend
   - Duration: 3s, staggered with yawn
3. **Drowsy Eyes**: Eyes slowly droop and open
   - Eyes scale Y to simulate heavy lids
   - Duration: 2.5s

**Visual Details**:
- Eyes almost closed, drowsy
- Mouth open in yawn
- Body in stretched pose or curled
- Teal/mint relaxation glow
- "zzz" or sleep particles optional

### cat-celebrate.svg
**Mood**: Excited, jumping, overjoyed
**Animations Required**:
1. **Jump/Bounce**: Cat bounces up and down
   - TranslateY -8px to 0
   - Quick bounce with slight squash on land
   - Duration: 0.6s
2. **Tail Wag**: Rapid tail wagging
   - Rotate -20deg to +20deg
   - Duration: 0.3s (fast!)
3. **Sparkles**: 3-5 sparkles around cat
   - Fade in/out with scale
   - Staggered timing
   - Duration: 0.8s per sparkle
4. **Happy Eyes**: Eyes become "^_^" shape
   - Curved happy arcs
   - Slight bounce with body

**Visual Details**:
- Eyes as happy curves (^_^)
- Mouth open in smile
- Paws raised slightly
- Gold sparkles/stars around
- Blush marks on cheeks
- Overall upward energy

---

## Companion 2: Robot 🤖

A friendly, rounded robot with LED indicators and antenna.

### Base Design
- **Shape**: Rounded rectangle body (~35x40px)
- **Head**: Rounded square with antenna on top
- **Antenna**: Thin pole with glowing ball on top
- **Eyes**: Two round LED screens (can display expressions)
- **Chest Panel**: Small rectangular panel with indicator lights
- **Arms**: Short rounded arm nubs on sides
- **Wheels/Feet**: Small rounded base

### robot-idle.svg
**Mood**: Standby mode, waiting, low power
**Animations Required**:
1. **Antenna Pulse**: Ball on antenna glows/dims
   - Opacity 0.4 to 1.0
   - Duration: 2s
2. **Chest LED Blink**: Single LED blinks slowly
   - One light blinks on/off
   - Duration: 3s
3. **Gentle Hover**: Very subtle up/down float
   - TranslateY 0 to -2px
   - Duration: 3s

**Visual Details**:
- Eyes showing ":" colon expression (standby)
- Dim glow overall
- Neutral arm position
- Gray/blue tones

### robot-focus.svg
**Mood**: Processing, computing, active
**Animations Required**:
1. **Eye Scan**: Eyes move left-right (scanning)
   - Pupils translate X back and forth
   - Duration: 1.5s
2. **Antenna Spin**: Ball rotates or antenna wobbles
   - Rotate 360deg (if ball has pattern)
   - Duration: 1s
3. **Chest Processing**: Multiple LEDs in sequence
   - 3 LEDs light up in sequence (like loading)
   - Duration: 0.8s
4. **Active Glow**: Orange glow pulses around body
   - Opacity 0.3 to 0.6
   - Duration: 1.5s

**Visual Details**:
- Eyes showing "⊙_⊙" focused expression
- All LEDs bright
- Orange processing glow
- Antenna bright and active

### robot-break.svg
**Mood**: Recharging, power saving, rest mode
**Animations Required**:
1. **Power Down Droop**: Head tilts down slightly
   - Rotate head 5deg forward
   - Duration: 3s (slow)
2. **Dim Pulse**: All lights dim and brighten slowly
   - Opacity 0.3 to 0.6
   - Duration: 4s
3. **Sleep LED**: Single LED shows "ZZZ" or pulses green
   - Green color, slow pulse
   - Duration: 2s
4. **Battery Charge**: Battery icon fills animation
   - If showing battery, fills up
   - Duration: 3s

**Visual Details**:
- Eyes showing "- -" or "u_u" sleeping
- Teal/green glow (charging)
- Head slightly drooped
- Minimal LED activity
- Maybe small "zzz" text

### robot-celebrate.svg
**Mood**: Victory dance, system success, party mode
**Animations Required**:
1. **Arm Raise**: Arms go up and down
   - Both arms rotate up 45deg
   - Duration: 0.5s
2. **Body Bounce**: Robot bounces/vibrates
   - TranslateY with slight rotation
   - Duration: 0.4s
3. **Antenna Spin**: Rapid antenna spinning
   - Full 360deg rotation
   - Duration: 0.5s
4. **LED Rave**: All LEDs flash rapidly in colors
   - Color cycle or rapid on/off
   - Duration: 0.3s
5. **Confetti**: Small squares/shapes fall
   - Multiple colored rectangles
   - Fall with slight rotation
   - Duration: 1s, staggered

**Visual Details**:
- Eyes showing "^_^" or "★_★"
- All LEDs multicolor
- Arms raised high
- Gold/rainbow confetti
- Maximum brightness

---

## Companion 3: Plant 🌱

A cute potted plant with leaves that grows and blooms.

### Base Design
- **Pot**: Rounded terracotta pot at bottom (~30px wide)
- **Stem**: Main green stem rising from pot
- **Leaves**: 3-4 leaves branching from stem
- **Face**: Cute face on the pot OR on a flower
- **Soil**: Brown soil visible at pot top

### plant-idle.svg
**Mood**: Peaceful swaying, resting, photosynthesizing
**Animations Required**:
1. **Leaf Sway**: All leaves sway gently
   - Rotate each leaf ±5deg
   - Stagger timing for natural look
   - Duration: 3.5s per leaf
2. **Gentle Sparkle**: Occasional sparkle on leaves
   - Single sparkle fades in/out
   - Duration: 4s
3. **Breathing Swell**: Whole plant breathes
   - Scale 1.0 to 1.02
   - Duration: 4s

**Visual Details**:
- Happy relaxed face (‿)
- Leaves in natural positions
- Soft green glow
- 1-2 small sparkles

### plant-focus.svg
**Mood**: Growing, thriving, photosynthesis overdrive
**Animations Required**:
1. **Growth Pulse**: Plant subtly grows larger
   - Scale 1.0 to 1.05 to 1.0
   - Duration: 2s
2. **Leaf Unfurl**: Leaves expand/open
   - Leaves scale/rotate to fuller position
   - Duration: 2s
3. **Energy Glow**: Green/yellow aura pulses
   - Glow layer opacity 0.2 to 0.5
   - Duration: 1.5s
4. **Sparkle Rain**: Multiple sparkles descend
   - 3-4 sparkles falling onto leaves (sunlight)
   - Duration: 2s

**Visual Details**:
- Determined face (•̀ᴗ•́)
- Leaves spread wide
- Orange/yellow sunlight glow
- More vibrant green color
- Visible growth energy

### plant-break.svg
**Mood**: Blooming, flowering, reward time
**Animations Required**:
1. **Flower Bloom**: Flower opens from bud
   - Petals scale from 0 to 1 (unfold)
   - Duration: 3s, then stays open
2. **Petal Flutter**: Open petals sway
   - Subtle rotation on each petal
   - Duration: 2.5s
3. **Content Sway**: Gentle peaceful movement
   - Whole plant sways
   - Duration: 3s
4. **Floating Petals**: 1-2 petals drift down
   - Petals fall slowly with rotation
   - Duration: 4s

**Visual Details**:
- Blissful face (◠‿◠)
- Beautiful flower on top
- Pink/white petals
- Teal relaxation glow
- Petals occasionally falling

### plant-celebrate.svg
**Mood**: Full bloom, multiple flowers, explosion of growth
**Animations Required**:
1. **Rapid Growth**: Plant shoots up
   - Quick scale increase
   - Duration: 0.5s at start
2. **Multi-Bloom**: Multiple flowers burst open
   - 2-3 flowers animate open
   - Staggered by 0.2s
   - Duration: 0.6s each
3. **Petal Explosion**: Many petals fly outward
   - 8-10 petals radiate out
   - Scale and fade
   - Duration: 1s
4. **Sparkle Burst**: Lots of sparkles
   - 5+ sparkles in burst pattern
   - Duration: 0.8s
5. **Bounce**: Plant bounces with joy
   - TranslateY bounce
   - Duration: 0.5s

**Visual Details**:
- Overjoyed face (≧◡≦)
- Multiple colorful flowers
- Petals everywhere
- Gold sparkles
- Maximum bloom state
- Rainbow/gold aura

---

## Companion 4: Flame 🔥

A friendly fire spirit with expressive flames.

### Base Design
- **Shape**: Teardrop/flame shape as body
- **Face**: Cute face in the flame center
- **Outer Flames**: Flickering outer flames
- **Core**: Brighter inner core
- **Base**: Small ember base at bottom

### flame-idle.svg
**Mood**: Calm burning, gentle warmth, resting flame
**Animations Required**:
1. **Flame Flicker**: Outer edges waver
   - Multiple flame tips move independently
   - ScaleY and slight rotation
   - Duration: 1.5s per tip, staggered
2. **Core Pulse**: Inner core brightens/dims
   - Opacity 0.8 to 1.0
   - Duration: 2s
3. **Gentle Dance**: Whole flame sways slightly
   - Rotate ±3deg
   - Duration: 3s
4. **Ember Glow**: Base embers pulse
   - Small circles pulse opacity
   - Duration: 2.5s

**Visual Details**:
- Peaceful face (◡‿◡)
- Warm orange/yellow colors
- Soft outer glow
- Calm, steady burn
- Red/orange gradient

### flame-focus.svg
**Mood**: Intense burning, powerful, determined
**Animations Required**:
1. **Intense Flicker**: Faster, taller flames
   - ScaleY 1.0 to 1.2
   - Faster frequency
   - Duration: 0.8s
2. **Height Growth**: Flame grows taller
   - Overall scaleY increase
   - Duration: 1.5s
3. **Core Intensity**: Core burns brighter
   - White/yellow core pulses
   - Opacity near 1.0
   - Duration: 1s
4. **Heat Waves**: Distortion lines rise
   - Wavy lines rise upward
   - Duration: 1.5s

**Visual Details**:
- Determined face (•̀_•́)
- Taller flame shape
- White-hot core
- Orange focus aura
- More flame tips
- Intense colors (orange/white)

### flame-break.svg
**Mood**: Ember mode, warm glow, resting coals
**Animations Required**:
1. **Shrink Down**: Flame becomes smaller
   - Lower scaleY overall
   - Duration: initial, then maintain
2. **Gentle Ember**: Base glows warmly
   - Slow pulse of red/orange
   - Duration: 3s
3. **Sleepy Flicker**: Minimal flame movement
   - Very subtle tip movement
   - Duration: 2s
4. **Cozy Glow**: Warm aura pulses
   - Teal-ish warmth
   - Duration: 2.5s

**Visual Details**:
- Sleepy face (u_u) or (- ‿ -)
- Smaller, rounder shape
- Ember colors (red/orange)
- Cozy teal glow
- Almost coal-like base
- Peaceful and warm

### flame-celebrate.svg
**Mood**: Firework explosion, sparkler, maximum energy
**Animations Required**:
1. **Firework Burst**: Sparks shoot outward
   - 8+ spark lines radiate
   - Quick scale and fade
   - Duration: 0.6s, repeating
2. **Dancing Flame**: Rapid bouncing
   - TranslateY bounce
   - Rotate back and forth
   - Duration: 0.4s
3. **Color Cycle**: Flame cycles colors
   - Orange → Yellow → White → Orange
   - Duration: 0.8s
4. **Sparkler Effect**: Continuous sparks
   - Small dots flying off
   - Duration: 0.3s, staggered
5. **Maximum Height**: Tallest flame state
   - ScaleY 1.2-1.3
   - Duration: hold

**Visual Details**:
- Ecstatic face (≧∇≦)
- Maximum height and size
- White-hot core
- Multicolor sparks
- Firework-like explosion
- Gold/rainbow sparkles
- Maximum intensity

---

## Animation Code Examples

### Example: Breathing Animation
```css
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.02); }
}
.body {
  animation: breathe 3.5s ease-in-out infinite;
}
```

### Example: Tail Sway
```css
@keyframes tailSway {
  0%, 100% { transform: rotate(-15deg); }
  50% { transform: rotate(15deg); }
}
.tail {
  transform-origin: 45px 35px; /* Base of tail */
  animation: tailSway 3s ease-in-out infinite;
}
```

### Example: Bounce
```css
@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.character {
  animation: bounce 0.6s ease-out infinite;
}
```

### Example: Sparkle
```css
@keyframes sparkle {
  0%, 100% { opacity: 0; transform: scale(0); }
  50% { opacity: 1; transform: scale(1); }
}
.sparkle-1 { animation: sparkle 0.8s ease-out infinite; }
.sparkle-2 { animation: sparkle 0.8s ease-out infinite 0.2s; }
.sparkle-3 { animation: sparkle 0.8s ease-out infinite 0.4s; }
```

### Example: LED Sequence
```css
@keyframes ledSequence {
  0%, 100% { fill: #333; }
  33% { fill: #0f0; }
}
.led-1 { animation: ledSequence 0.8s infinite; }
.led-2 { animation: ledSequence 0.8s infinite 0.27s; }
.led-3 { animation: ledSequence 0.8s infinite 0.54s; }
```

### Example: Flame Flicker
```css
@keyframes flicker {
  0%, 100% { transform: scaleY(1) scaleX(1); }
  25% { transform: scaleY(1.05) scaleX(0.95); }
  50% { transform: scaleY(0.95) scaleX(1.05); }
  75% { transform: scaleY(1.08) scaleX(0.97); }
}
.flame-outer {
  transform-origin: center bottom;
  animation: flicker 1.5s ease-in-out infinite;
}
```

### Example: Blink with Pause
```css
@keyframes blink {
  0%, 90%, 100% { transform: scaleY(1); }
  95% { transform: scaleY(0.1); }
}
.eye {
  transform-origin: center;
  animation: blink 4s ease-in-out infinite;
}
```

### Example: Staggered Leaf Sway
```css
@keyframes leafSway {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}
.leaf-1 { 
  transform-origin: bottom center;
  animation: leafSway 3.5s ease-in-out infinite; 
}
.leaf-2 { 
  transform-origin: bottom center;
  animation: leafSway 3.5s ease-in-out infinite 0.5s; 
}
.leaf-3 { 
  transform-origin: bottom center;
  animation: leafSway 3.5s ease-in-out infinite 1s; 
}
```

---

## Quality Checklist

For each SVG file, verify:

- [ ] ViewBox is exactly `0 0 64 64`
- [ ] No width/height attributes on root SVG
- [ ] All animations use `infinite` keyword
- [ ] Animations auto-play (no triggers needed)
- [ ] Colors match the specified palette
- [ ] Character is centered and fills ~80% of space
- [ ] Face/expression is clearly visible
- [ ] Animation timing matches the state energy level
- [ ] File is valid SVG (no errors)
- [ ] Works in both light and dark themes
- [ ] File size under 10KB each
- [ ] Animations loop seamlessly (no jarring jumps)

---

## Priority Order

Generate in this order:
1. `cat-idle.svg` - Template for cat, most common state
2. `cat-focus.svg` - Core functionality
3. `cat-break.svg` - Important state
4. `cat-celebrate.svg` - Reward state
5. `robot-*` series
6. `flame-*` series  
7. `plant-*` series

---

## Notes for AI Generation

- Keep designs **cute and friendly** - round shapes, soft expressions
- **Consistency** is key - same character across all 4 states
- **Don't overcomplicate** - simple shapes animate better
- Test that animations loop **seamlessly** with no jarring jumps
- The **face is the soul** - expressions matter most
- **Less is more** - 2-3 good animations beat 10 janky ones
- Each file is **standalone** - no dependencies between files
- Face should always be **visible and expressive**
- Consider **dark and light themes** - avoid pure black outlines
