# WarLike Rig Studio

**Prototype indépendant v0.1** pour préparer un rig humanoïde à partir d'un modèle GLB **non riggé**, sans modifier son nombre de sommets ni réduire la définition de son visage. Développé pour l'écosystème WarLike, notamment WarLike Heart.

## Utilisation

1. Ouvrir `index.html` dans un navigateur HTTPS (Cloudflare Pages ou équivalent) avec WebGL et accès au CDN Three.js. Le site est statique et ne nécessite aucun compte.
2. Importer un GLB humanoïde debout, **Y vers le haut**, de préférence en A-pose, sans squelette préalable.
3. Conserver « Préserver rigidement la tête », puis cliquer sur **Créer le rig humanoïde**.
4. Basculer entre le modèle original et le rig ; utiliser **Pose test** et **Repos** pour vérifier les articulations.
5. Exporter le GLB riggé et vérifier la réimportation dans WarLike Engine.

Les modèles sont lus **dans le navigateur**, sans envoi sur un serveur applicatif. Import limité à 150 Mio. Le code JavaScript utilise Three.js 0.160.1 via CDN.

## Contenu réellement implémenté

- Import local d'un GLB et aperçu Three.js avec contrôles orbitaux.
- Diagnostic des maillages, sommets, triangles, skins et morph targets.
- Placement **heuristique** de 19 os humanoïdes et création d'une hiérarchie d'os.
- Affectation automatique expérimentale de quatre influences maximum par sommet selon la position, sans décimation de géométrie.
- **Protection de la tête** : les sommets situés dans la région supérieure sont liés rigidement à l'os Head. Cela vise à éviter les déformations faciales provoquées par un mauvais skinning, mais n'améliore pas la qualité géométrique du visage d'origine.
- Pose simple de test et restauration de la pose neutre.
- Export du rig/skin en GLB ; le GLB doit être testé dans d'autres logiciels après export.
- Refus d'auto-rigger un modèle possédant déjà un skin (évite l'écrasement involontaire).
- Tests Node des algorithmes de base ; workflow GitHub Actions.

## Limites importantes

**Prototype technique, pas un outil de rigging final ni une garantie d'animation correcte.** L'auto-placement repose sur des ratios corporels fixes, **pas sur une détection anatomique**. Le résultat dépend fortement de la pose, de l'orientation, des proportions et de la position du personnage. Les cheveux, vêtements et doigts peuvent mal se déformer ; il faut inspecter les épaules, coudes, hanches et genoux. Aucun contrôle visuel réel du rendu dans un navigateur ou test complet d'export-import n'est encore confirmé.

- Pas de peinture manuelle des poids, placement interactif des os, ni IK d'édition.
- Pas de poids automatiques fondés sur géodésiques ou diffusion volumique.
- Pas de génération de blendshapes, d'expressions faciales, de mâchoire ni de visèmes.
- Pas de retopologie, normal-map baking ni réduction des polygones : les modèles volumineux restent volumineux.
- Aucun traitement garantissant la ressemblance du visage avec une photo ou un portrait.
- Aucune animation incluse dans l'export, seulement un rig pour animation ultérieure.
- Export GLB à valider avec des modèles variés et dans WarLike Engine, sans faire passer un simple test de syntaxe pour une validation du résultat 3D.

## Architecture

`index.html` — interface autonome et panneau de contrôle.

`studio.js` — chargement GLB, Three.js, liaison au squelette, aperçu des poses et export GLB.

`rig-core.mjs` — placement des os et fonctions de pondération pures et testables.

`tests/rig-core.test.mjs` — contrôles de cohérence des calculs.

## Connexion future

Ce projet est volontairement distinct de [WarLike Engine](https://github.com/Motherlode94/WarLike-Engine). Une future intégration pourra échanger des GLB validés ou un format de rig partagé. Pour WarLike Heart, la prochaine étape reste le contrôle manuel de la tête et l'ajout de blendshapes faciaux avant l'animation labiale.

## Sécurité

N'importer que des GLB de provenance fiable. Des fichiers 3D volumineux peuvent saturer le GPU ou la mémoire. Aucune donnée personnelle ni clé API ne doit être commitée dans ce dépôt.
