export type Virtue = 'Patience' | 'Discipline' | 'Focus'

export interface ConductLine {
  text: string
  virtue: Virtue
}

/** From `docs/knowledge-base/code-of-conduct.md`. */
export const CODE_OF_CONDUCT: ConductLine[] = [
  { text: 'Market is God and I am very grateful to Market for giving opportunities to succeed.', virtue: 'Focus' },
  { text: 'I follow the market price action and not my mind.', virtue: 'Focus' },
  { text: 'I trade only high probability setups.', virtue: 'Patience' },
  { text: 'I always mind my entry.', virtue: 'Discipline' },
  { text: 'I analyse charts as if I have no position in them.', virtue: 'Focus' },
  { text: 'I consistently follow my trading plans.', virtue: 'Discipline' },
  { text: 'I am accountable for my trading.', virtue: 'Discipline' },
  { text: 'I keep my trading diary with performance matrix.', virtue: 'Discipline' },
  { text: 'I am always with the dominant force in the market.', virtue: 'Patience' },
  { text: 'I believe in my trading strategies completely and whole heartedly.', virtue: 'Discipline' },
  { text: 'I always follow what the market is doing and not what I want market to do.', virtue: 'Patience' },
  { text: 'I practice proper risk management, I let the profit run and take only small losses.', virtue: 'Discipline' },
  { text: 'I take only those trades that give me reward which clearly outweighs the risk.', virtue: 'Patience' },
  { text: 'I find other things to do once my trades go live.', virtue: 'Focus' },
  { text: 'I am not emotionally affected by profits/losses.', virtue: 'Focus' },
  { text: 'I count my profit only after exiting my trades.', virtue: 'Patience' },
  { text: 'I continue to stay in my trades till I find a good cause to exit.', virtue: 'Patience' },
  { text: 'I am happy and satisfied with every profit.', virtue: 'Patience' },
  { text: 'I respect money and I always protect my capital.', virtue: 'Discipline' },
  { text: 'I am detached from news and fundamentals while trading.', virtue: 'Focus' },
  { text: 'I am the most disciplined trader ever.', virtue: 'Discipline' },
  { text: 'I am happy and a successful trader.', virtue: 'Focus' },
]
