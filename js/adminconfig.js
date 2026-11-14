/* ADMIN PASSWORD SETTINGS  (the only file you edit to set your admin password)
   Leave hash empty and the admin menu is switched off.
   To create your password: open the game, press the ` key (or tap the top-middle of the screen 5 times),
   type a new password, and paste the block it shows over the line below. Then save/commit this file.
   Only a scrambled "hash" is stored here, never your password. */
window.AB = window.AB || {};
AB.ADMIN = { salt: 'f5ae23339e275707668d172a7df1a381', iter: 150000, hash: '4a760cee1138a34391947a6ed49843552db701f8f931de7ef63aa98b0dc82e6e' };
AB.ADMIN = { salt: '', iter: 150000, hash: '' };
