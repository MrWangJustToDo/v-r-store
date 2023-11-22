import { reactive, toRaw } from "@vue/reactivity";

import { connectDevTool } from "../shared/dev";
import { isServer } from "../shared/env";
import { createHook } from "../shared/hook";
import { createLifeCycle } from "../shared/lifeCycle";
import { checkHasFunction, checkHasReactive, checkHasSameField } from "../shared/tools";

import { withActions, withNamespace, withPersist } from "./middleware";
import { getFinalActions, getFinalNamespace, getFinalState } from "./tools";

import type { Setup } from "./createState";
import type { MaybeStateWithMiddleware, WithActionsProps, UnWrapMiddleware } from "./tools";

/**
 * @internal
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export function internalCreateState<T extends Record<string, unknown>, P extends Record<string, Function>, L extends Record<string, Function>>(
  setup: Setup<MaybeStateWithMiddleware<T, L>>,
  name: string,
  option?: {
    withPersist?: string;
    withActions?: WithActionsProps<UnWrapMiddleware<T>, P>["generateActions"];
    withNamespace?: string;
    withDeepSelector?: boolean;
  }
) {
  let creator: any = setup;

  if (option?.withPersist) {
    creator = withPersist(creator, { key: option.withPersist });
  }

  if (option?.withActions) {
    creator = withActions(creator, { generateActions: option.withActions });
  }

  if (option?.withNamespace) {
    creator = withNamespace(creator, { namespace: option.withNamespace, reduxDevTool: true });
  }

  const lifeCycle = createLifeCycle();

  const state = creator();

  // handle withActions middleware;
  const initialState = getFinalState(state) as T;

  let actions = getFinalActions(state);

  const namespace = getFinalNamespace(state);

  const rawState = toRaw(initialState);

  const reduxDevTool = __DEV__ && namespace.reduxDevTool && !isServer;

  if (__DEV__ && checkHasReactive(rawState)) {
    console.error(
      `[reactivity-store] '${name}' expect receive a plain object but got a reactive object/field %o, this is a unexpected usage. should not use 'reactiveApi' in this 'setup' function`,
      rawState
    );
  }

  if (__DEV__ && checkHasFunction(rawState)) {
    console.error(
      `[reactivity-store] '${name}' has a function field in state %o, this is a unexpected usage. state should be only a plain object with data field`,
      rawState
    );
  }

  if (__DEV__) {
    const sameField = checkHasSameField(rawState, actions);
    sameField.forEach((key) =>
      console.warn(`[reactivity-store] duplicate key: [${key}] in 'state' and 'actions' from createState, this is a unexpected usage`)
    );
  }

  if (reduxDevTool) {
    actions = connectDevTool(namespace.namespace, actions, rawState) as P;
  }

  const reactiveState = reactive(initialState);

  const deepSelector = option?.withDeepSelector ?? true;

  const useSelector = createHook<T, P & L>(reactiveState, rawState, lifeCycle, deepSelector, namespace.namespace, actions as P & L);

  return useSelector;
}
