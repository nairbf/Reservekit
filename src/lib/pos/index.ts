import { cloverAdapter } from "./clover";
import { squareAdapter } from "./square";
import { toastAdapter } from "./toast";
import type { PosAdapter, PosProvider } from "./types";

const adapters: Record<PosProvider, PosAdapter> = {
  square: squareAdapter,
  toast: toastAdapter,
  clover: cloverAdapter,
  // SpotOn keeps its existing dedicated integration paths for now.
  spoton: squareAdapter,
};

export function isPosProvider(value: string): value is PosProvider {
  return value === "square" || value === "toast" || value === "clover" || value === "spoton";
}

export function getPosAdapter(provider: PosProvider): PosAdapter {
  return adapters[provider];
}

export function getAvailableProviders(): PosAdapter[] {
  return [squareAdapter, toastAdapter, cloverAdapter];
}

export * from "./types";
