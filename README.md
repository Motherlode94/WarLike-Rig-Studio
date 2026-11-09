# WarLike Rig Studio

**Prototype indépendant v0.6** pour préparer un rig humanoïde à partir d'un modèle GLB **riggé ou non riggé**, sans modifier son nombre de sommets ni réduire la définition de son visage. Développé pour l'écosystème WarLike, notamment WarLike Heart.

## Utilisation

**Interface v0.6 :** la vue 3D occupe tout l'écran. Utiliser le bouton **☰ Outils** pour ouvrir le menu, puis choisir Importer, Squelette, Articulations, Animation, Export ou Diagnostics. Le panneau se ferme avec ✕, Échap ou un clic en dehors. Les options n'occupent plus l'écran en permanence.

1. Ouvrir `index.html` dans un navigateur HTTPS (Cloudflare Pages ou équivalent) avec WebGL et accès au CDN Three.js. Le site est statique et ne nécessite aucun compte.
2. Importer un GLB humanoïde debout, **Y vers le haut**. Un modèle **déjà riggé est reconnu** et ses poids, os, textures et animations existants sont conservés. Un modèle non riggé peut recevoir un nouveau squelette.
3. Si le GLB est **sans rig**, conserver « Préserver rigidement la tête », puis cliquer sur **Créer le rig humanoïde**. Si le GLB est **déjà riggé**, ne pas lancer cette opération : utiliser directement Articulations (inspection en lecture seule) ou Animation.
4. Basculer entre le modèle original et le rig ; ouvrir **☰ Outils → Animation**, choisir un mouvement, puis utiliser **▶ Lire**. La timeline permet de déplacer librement le temps du test. **⏸ Pause** fige la pose et **↺ Repos** remet tous les os à leur état initial.
5. Exporter le GLB riggé et vérifier la réimportation dans WarLike Engine.

Les modèles sont lus **dans le navigateur**, sans envoi sur un serveur applicatif. Import limité à 150 Mio. Le code JavaScript utilise Three.js 0.160.1 via CDN.

## Contenu réellement implémenté

- Import local d'un GLB et aperçu Three.js avec contrôles orbitaux.
- Diagnostic des maillages, sommets, triangles, skins et morph targets.\n- **Prise en charge des GLB déjà riggés :** reconnaissance des SkinnedMesh, des squelettes et des noms d'os usuels Mixamo/Blender, inspection colorée des articulations en lecture seule, lecture des clips d'animation intégrés, et tests procéduraux compatibles avec les os identifiés. L'auto-rig ne remplace jamais les poids existants.\n- Export d'un GLB déjà riggé avec tentative de conservation de ses clips intégrés ; validation du round-trip requise.
- Placement **heuristique** de 19 os humanoïdes et création d'une hiérarchie d'os.
- Affectation automatique expérimentale de quatre influences maximum par sommet selon la position, sans décimation de géométrie.
- **Protection de la tête** : les sommets situés dans la région supérieure sont liés rigidement à l'os Head. Cela vise à éviter les déformations faciales provoquées par un mauvais skinning, mais n'améliore pas la qualité géométrique du visage d'origine.
- Placement interactif des articulations : points colorés, gizmo de déplacement, coordonnées X/Y/Z, symétrie et annulation (prototype à valider sur de vrais GLB).\n- **Tests de rig directement dans le navigateur :** 7 mouvements de diagnostic (respiration, bras et coudes, marche sur place, jambes, tête et cou, torse, séquence complète), lecture/pause, boucle, vitesse de 0,25× à 2×, amplitude 0 à 150 %, contrôle de fluidité 0 à 100 %, timeline et pose neutre. Les rotations procédurales utilisent une interpolation par quaternion pour limiter les mouvements brusques. Les rotations restent temporaires ; aucun changement des poids ou de la géométrie importés.\n- Pose simple de test et restauration de la pose neutre.
- Export du rig/skin en GLB ; le GLB doit être testé dans d'autres logiciels après export.
- Protection des modèles possédant déjà un skin : aucun recalcul automatique des poids et aucune édition destructive de leur bind pose.
- Tests Node des algorithmes de base ; workflow GitHub Actions.

## Limites importantes

**Prototype technique, pas un outil de rigging final ni une garantie d'animation correcte.** L'auto-placement repose sur des ratios corporels fixes, **pas sur une détection anatomique**. Le résultat dépend fortement de la pose, de l'orientation, des proportions et de la position du personnage. Les cheveux, vêtements et doigts peuvent mal se déformer ; il faut inspecter les épaules, coudes, hanches et genoux. Aucun contrôle visuel réel du rendu dans un navigateur ou test complet d'export-import n'est encore confirmé.

- Les nouveaux rigs utilisent une pondération plus douce autour des articulations, mais **pas encore une véritable peinture des poids** ni une déformation anatomique avancée (twist bones, correctives, IK).\n- Les GLB déjà riggés gardent les poids d'origine : le réglage de fluidité n'améliore pas un skinning existant incorrect et ne remplace pas les clés de leur animation native.\n- Pas de peinture manuelle des poids ni IK d'édition ; le placement interactif des os reste expérimental.
- Pas de poids automatiques fondés sur géodésiques ou diffusion volumique.
- Pas de génération de blendshapes, d'expressions faciales, de mâchoire ni de visèmes.
- Pas de retopologie, normal-map baking ni réduction des polygones : les modèles volumineux restent volumineux.
- Aucun traitement garantissant la ressemblance du visage avec une photo ou un portrait.
- Les animations de test sont procédurales et **ne sont pas incluses dans le GLB exporté** : l'export conserve la pose de repos, avec un rig pour animation ultérieure.\n- Les mouvements ne constituent pas une bibliothèque d'animations professionnelles, ni des tests physiques de collisions ou IK.
- Les **rigs à noms personnalisés** sont reconnus s'ils possèdent un SkinnedMesh et un squelette, mais les mouvements procéduraux ciblent seulement les os faisant correspondance avec le dictionnaire humanoïde. Les clips natifs restent disponibles lorsqu'ils existent.\n- Les fichiers multi-squelettes et les animations spécifiques doivent encore être validés visuellement.\n- Export GLB à valider avec des modèles variés et dans WarLike Engine, sans faire passer un simple test de syntaxe pour une validation du résultat 3D.

## Architecture

`index.html` — interface autonome et panneau de contrôle.

`studio.js` — chargement GLB, Three.js, liaison au squelette, aperçu des poses et export GLB.

`rig-core.mjs` — placement des os et fonctions de pondération pures et testables.\n\n`existing-rig.mjs` — reconnaissance des squelettes GLB déjà riggés et correspondance de noms humanoïdes.

`tests/rig-core.test.mjs` — contrôles de cohérence des calculs.

## Connexion future

Ce projet est volontairement distinct de [WarLike Engine](https://github.com/Motherlode94/WarLike-Engine). Une future intégration pourra échanger des GLB validés ou un format de rig partagé. Pour WarLike Heart, la prochaine étape reste le contrôle manuel de la tête et l'ajout de blendshapes faciaux avant l'animation labiale.

## Sécurité

N'importer que des GLB de provenance fiable. Des fichiers 3D volumineux peuvent saturer le GPU ou la mémoire. Aucune donnée personnelle ni clé API ne doit être commitée dans ce dépôt.
