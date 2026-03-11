export function createStore(initialState = {}) {
  const state = initialState;
  const listeners = new Set();

  return {
    state,
    getState() {
      return state;
    },
    setState(partial = {}) {
      Object.assign(state, partial);
      listeners.forEach((listener) => {
        try {
          listener(state);
        } catch (_error) {
          // Ignore listener errors to keep store stable.
        }
      });
      return state;
    },
    subscribe(listener) {
      if (typeof listener !== "function") {
        return () => {};
      }
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
