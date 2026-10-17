/**
 * Entkoppelte Queue-Fassade für das nicht-blockierende Hintergrund-Prewarming
 * von WordCloud-Embeddings nach Q&A- und Freitext-Submits, analog zu `qaNlpQueue`.
 */
export { scheduleWordCloudSemanticEmbeddingPrewarm } from './wordCloudSemanticAnalyze';
