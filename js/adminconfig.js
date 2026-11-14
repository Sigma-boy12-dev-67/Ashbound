/* ADMIN PASSWORD SETTINGS  (the only file you edit to set your admin password)
   Leave hash empty and the admin menu is switched off.
   To create your password: open the game, press the ` key (or tap the top-middle of the screen 5 times),
   type a new password, and paste the block it shows over the line below. Then save/commit this file.
   Only a scrambled "hash" is stored here, never your password. */
window.AB = window.AB || {};
AB.ADMIN = { salt: '', iter: 150000, hash: '' };
