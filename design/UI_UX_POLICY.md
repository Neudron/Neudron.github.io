# UI / UX policy

The portfolio remains small, responsive and secret-preserving; in-game systems should feel like related objects, not unrelated modal websites.

- Inventory: C opens; separate melee/ranged/spells/consumables with distinct item silhouettes and valid current equip state. Z confirms, X returns when appropriate; alternative keyboard/touch bindings visible.
- Shop: merchant stays on screen with Buy, Sell, Talk, Exit; give focus/hover/selected states and purchase handover animation.
- Dialogue: Z advances immediately or skips already-displayed text; input cannot leak into world interaction on the same frame.
- Craft: paper recipe object stays in scene, ingredients and state visibly update, explicit CRAFT confirm; crafting soup does not automatically drink it.
- Rhythm: lane direction and active key mapping are unambiguous, notes stay in time during pause/restart and across soul transition.
- Damage/TP: a text readout alone is insufficient; show relevant bar/number reaction without obstructing movement.
- Menus expose focus for controller/keyboard/touch, support back and Escape consistently, and maintain safe-area margins on phones.
- Text contrast meets WCAG AA where applicable; reduced motion avoids camera-borne reading difficulty.
