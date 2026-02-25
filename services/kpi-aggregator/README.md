# KPI Aggregator

Ce service agrège les métriques des tickets en temps réel et publie les KPI dans une queue Kafka.

## Fonctionnalités

- Consomme les tickets labelisés depuis `tickets_labelized`
- Calcule les KPI en temps réel (agrégation en mémoire)
- Publie périodiquement les KPI dans `tickets_kpi`

## KPI calculés

- **Total de tickets**: Nombre total de tickets traités
- **Par type**: Répartition bug/feature/question
- **Par label**: Répartition Mobile/Web/Back-end/Infra
- **Par priorité**: Répartition par niveau de priorité (0-3)
- **Dernière mise à jour**: Timestamp de la dernière mise à jour

## Variables d'environnement

- `KAFKA_BROKER`: Adresse du broker Kafka (défaut: `localhost:9092`)
- `KAFKA_INPUT_TOPIC`: Topic des tickets labelisés (défaut: `tickets_labelized`)
- `KAFKA_OUTPUT_TOPIC`: Topic des KPI (défaut: `tickets_kpi`)
- `KAFKA_GROUP_ID`: ID du groupe de consommateurs (défaut: `kpi-aggregator-group`)
- `PUBLISH_INTERVAL_MS`: Intervalle de publication des KPI en ms (défaut: `5000`)

## Utilisation

```bash
# Installation
pnpm install

# Développement
pnpm dev

# Production
pnpm build
pnpm start
```
