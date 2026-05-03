import { NativeModules, Platform } from 'react-native'

const { StoreKitModule } = NativeModules

export async function getProducts(productIds) {
  if (Platform.OS !== 'ios' || !StoreKitModule) return []
  try {
    return await StoreKitModule.getProducts(productIds)
  } catch (e) {
    console.log('[StoreKit] getProducts failed:', e)
    return []
  }
}

export async function purchase(productId) {
  if (Platform.OS !== 'ios' || !StoreKitModule) return null
  try {
    return await StoreKitModule.purchase(productId)
  } catch (e) {
    console.log('[StoreKit] purchase failed:', e)
    return null
  }
}

export async function restorePurchases() {
  if (Platform.OS !== 'ios' || !StoreKitModule) return []
  try {
    return await StoreKitModule.restorePurchases()
  } catch (e) {
    console.log('[StoreKit] restore failed:', e)
    return []
  }
}
