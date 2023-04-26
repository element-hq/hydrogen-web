import {ObservableArray} from "../../../observable";
import type {BaseToastNotificationViewModel} from "./BaseToastNotificationViewModel";

export interface IToastCollection {
    toastViewModels: ObservableArray<BaseToastNotificationViewModel>;
}
