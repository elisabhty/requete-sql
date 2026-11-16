# Les icônes de l’app au choix

Chaque dossier `NomDeLIcone.appiconset` (une image 1024 × 1024, avec son `Contents.json`) est recopié par
`scripts/ios-widget.mjs` dans le catalogue de l’app (`ios/App/App/Assets.xcassets`). Xcode les déclare toutes
(`ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS`), et l’app peut passer de l’une à l’autre sans nouvelle version
(`RequeteWidget.iconeChoisir`). Une nouvelle icône, elle, demande une nouvelle version de l’app.
