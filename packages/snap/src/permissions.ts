import { KeyringRpcMethod } from "@metamask/keyring-api";

export enum InternalMethod {
  ToggleSyncApprovals = "snap.internal.toggleSynchronousApprovals",
  IsSynchronousMode = "snap.internal.isSynchronousMode",
  SendUserOpBoba = "eth_sendUserOpBoba",
  SendUserOpBobaPM = "eth_sendUserOpBobaPM",
}

export const originPermissions = new Map<string, string[]>([
  [
    "metamask",
    [
      // Keyring methods
      KeyringRpcMethod.ListAccounts,
      KeyringRpcMethod.GetAccount,
      KeyringRpcMethod.FilterAccountChains,
      KeyringRpcMethod.DeleteAccount,
      KeyringRpcMethod.ListRequests,
      KeyringRpcMethod.GetRequest,
      KeyringRpcMethod.SubmitRequest,
      KeyringRpcMethod.RejectRequest
    ]
  ],
  [
    "http://localhost",
    [
      // Keyring methods
      KeyringRpcMethod.ListAccounts,
      KeyringRpcMethod.GetAccount,
      KeyringRpcMethod.CreateAccount,
      KeyringRpcMethod.FilterAccountChains,
      KeyringRpcMethod.UpdateAccount,
      KeyringRpcMethod.DeleteAccount,
      KeyringRpcMethod.ExportAccount,
      KeyringRpcMethod.SubmitRequest,
      KeyringRpcMethod.ListRequests,
      KeyringRpcMethod.GetRequest,
      KeyringRpcMethod.ApproveRequest,
      KeyringRpcMethod.RejectRequest,
      // Custom methods
      // TODO: determine if these methods need to be restricted to our own UI
      InternalMethod.SendUserOpBoba,
      InternalMethod.SendUserOpBobaPM
    ]
  ],
  [
    "https://gateway.boba.network",
    [
      // Keyring methods
      KeyringRpcMethod.ListAccounts,
      KeyringRpcMethod.GetAccount,
      KeyringRpcMethod.CreateAccount,
      KeyringRpcMethod.FilterAccountChains,
      KeyringRpcMethod.UpdateAccount,
      KeyringRpcMethod.DeleteAccount,
      KeyringRpcMethod.ExportAccount,
      KeyringRpcMethod.SubmitRequest,
      KeyringRpcMethod.ListRequests,
      KeyringRpcMethod.GetRequest,
      KeyringRpcMethod.ApproveRequest,
      KeyringRpcMethod.RejectRequest,
      // Custom methods
      // TODO: determine if these methods need to be restricted to our own UI
      InternalMethod.SendUserOpBoba,
      InternalMethod.SendUserOpBobaPM
    ]
  ],
  [
    "https://aa-hc-example-fe.onrender.com",
    [
      // Keyring methods
      KeyringRpcMethod.ListAccounts,
      KeyringRpcMethod.GetAccount,
      KeyringRpcMethod.CreateAccount,
      KeyringRpcMethod.FilterAccountChains,
      KeyringRpcMethod.UpdateAccount,
      KeyringRpcMethod.DeleteAccount,
      KeyringRpcMethod.ExportAccount,
      KeyringRpcMethod.SubmitRequest,
      KeyringRpcMethod.ListRequests,
      KeyringRpcMethod.GetRequest,
      KeyringRpcMethod.ApproveRequest,
      KeyringRpcMethod.RejectRequest,
      // Custom methods
      // TODO: determine if these methods need to be restricted to our own UI
      InternalMethod.SendUserOpBoba,
      InternalMethod.SendUserOpBobaPM
    ]
  ]
]);
