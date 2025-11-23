import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { useTheme } from '@/providers/ThemeProvider';
import { useSupabaseAuth } from '@/providers/SupabaseAuthProvider';
import { KeyboardDismissibleView } from '@/components/common';
import { useSession } from '@/providers/SessionProvider';
import { useInventory } from '@/hooks/useInventory';
import { useEventStagedInventory } from '@/hooks/useEventStagedInventory';
import { createInventoryItem, deleteInventoryItem, getInventoryItem, updateInventoryItem } from '@/lib/inventory';
import {
  createEventStagedInventoryItem,
  deleteEventStagedInventoryItem,
  getEventStagedInventoryItem,
  updateEventStagedInventoryItem,
  updateEventStagedInventoryStatus,
} from '@/lib/eventStagedInventory';
import { getItemImageUrl, removeItemImage, uploadItemImage } from '@/lib/itemImages';
import type { EventStagedInventoryItem } from '@/types/inventory';
import { FREE_PLAN_ITEM_LIMIT } from '@/lib/freePlanLimits';

type FormMode = 'inventory' | 'stage' | 'convert';

type FeedbackState = {
  type: 'success' | 'error' | 'info';
  message: string;
} | null;

type FormState = {
  name: string;
  price: string;
  sku: string;
  quantity: string;
  lowStock: string;
};

const defaultState: FormState = {
  name: '',
  price: '',
  sku: '',
  quantity: '',
  lowStock: '',
};

type ItemImageState = {
  id: string;
  uri: string;
  path?: string;
  uploading?: boolean;
};

export default function ItemFormScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useSupabaseAuth();
  const { currentSession, sharedOwnerId, sharedPlanTier, sharedPlanPaused } = useSession();
  const { itemId, mode: modeParam, eventId: eventIdParam, stagedId } = useLocalSearchParams<{
    itemId?: string;
    mode?: string;
    eventId?: string;
    stagedId?: string;
  }>();
  const userId = user?.id ?? null;
  const ownerUserId = sharedOwnerId ?? userId;

  const formMode: FormMode =
    modeParam === 'stage' || modeParam === 'convert' ? (modeParam as FormMode) : 'inventory';
  const isInventoryMode = formMode === 'inventory';
  const isStagingMode = formMode === 'stage';
  const isConvertMode = formMode === 'convert';

  const stageEventId =
    typeof eventIdParam === 'string' && eventIdParam.length > 0 ? eventIdParam : null;
  const stagingTargetId =
    typeof stagedId === 'string' && stagedId.length > 0 ? stagedId : null;

  const editingInventoryItem =
    isInventoryMode && typeof itemId === 'string' && itemId.length > 0;
  const editingStagedItem = !isInventoryMode && Boolean(stagingTargetId);

  const { items } = useInventory(ownerUserId);
  const { stagedItems } = useEventStagedInventory(ownerUserId);

  const planTier = sharedPlanTier;
  const planPaused = sharedPlanPaused;
  const planItemLimit = useMemo(() => {
    if (planPaused) return FREE_PLAN_ITEM_LIMIT;
    if (planTier === 'free') return FREE_PLAN_ITEM_LIMIT;
    if (!currentSession || currentSession.isHost) {
      const fromPlan = user?.subscription?.plan?.maxInventoryItems;
      if (typeof fromPlan === 'number' && fromPlan > 0) {
        return fromPlan;
      }
    }
    return null;
  }, [planPaused, planTier, currentSession?.isHost, user?.subscription?.plan?.maxInventoryItems]);

  const [form, setForm] = useState<FormState>(defaultState);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [loading, setLoading] = useState<boolean>(
    editingInventoryItem || editingStagedItem || isConvertMode,
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [images, setImages] = useState<ItemImageState[]>([]);
  const [removedImagePaths, setRemovedImagePaths] = useState<string[]>([]);
  const [imagePickerBusy, setImagePickerBusy] = useState(false);
  const [stagedItem, setStagedItem] = useState<EventStagedInventoryItem | null>(null);
  const [activeStageEventId, setActiveStageEventId] = useState<string | null>(stageEventId);

  useEffect(() => {
    if (isStagingMode && !editingStagedItem) {
      setActiveStageEventId(stageEventId);
    }
  }, [editingStagedItem, isStagingMode, stageEventId]);

  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    let isActive = true;

    const resolveImageState = async (paths: string[]): Promise<ItemImageState[]> => {
      if (!paths.length) return [];

      const results = await Promise.allSettled(paths.map((path) => getItemImageUrl(path)));

      return paths.map((path, index) => {
        const result = results[index];
        if (result.status === 'fulfilled') {
          return {
            id: path,
            uri: result.value,
            path,
            uploading: false,
          };
        }

        console.warn('Failed to resolve item image URL', result.reason);

        return {
          id: path,
          uri: '',
          path,
          uploading: false,
        };
      });
    };

    const loadData = async () => {
      if (!ownerUserId) {
        if (isActive) {
          setForm(defaultState);
          setImages([]);
          setRemovedImagePaths([]);
          setStagedItem(null);
          setActiveStageEventId(stageEventId);
          setLoading(false);
        }
        return;
      }

      if (!editingInventoryItem && !editingStagedItem && !isConvertMode) {
        if (isActive) {
          setForm(defaultState);
          setImages([]);
          setRemovedImagePaths([]);
          setStagedItem(null);
          setActiveStageEventId(stageEventId);
          setLoading(false);
        }
        return;
      }

      try {
        if (editingInventoryItem && itemId) {
          const item = await getInventoryItem({ userId: ownerUserId, itemId });
          if (item && isActive) {
            setForm({
              name: item.name,
              price: (item.priceCents / 100).toFixed(2),
              sku: item.sku ?? '',
              quantity: String(item.quantity ?? ''),
              lowStock: String(item.lowStockThreshold ?? ''),
            });
            const mappedImages = await resolveImageState(item.imagePaths ?? []);
            setImages(mappedImages);
            setRemovedImagePaths([]);
          }
        } else if ((editingStagedItem || isConvertMode) && stagingTargetId) {
          const staged = await getEventStagedInventoryItem({
            userId: ownerUserId,
            stagedId: stagingTargetId,
          });
          if (staged && isActive) {
            setForm({
              name: staged.name,
              price: (staged.priceCents / 100).toFixed(2),
              sku: staged.sku ?? '',
              quantity: String(staged.quantity ?? ''),
              lowStock: String(staged.lowStockThreshold ?? ''),
            });
            const mappedImages = await resolveImageState(staged.imagePaths ?? []);
            setImages(mappedImages);
            setRemovedImagePaths([]);
            setStagedItem(staged);
            setActiveStageEventId(staged.eventId);
          } else if (isActive) {
            setStagedItem(null);
          }
        }
      } catch (error) {
        console.error('Failed to load item', error);
        if (isActive) {
          const message = editingInventoryItem
            ? 'Unable to load item details.'
            : 'Unable to load staged inventory.';
          setFeedback({ type: 'error', message });
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void loadData();
    return () => {
      isActive = false;
    };
  }, [editingInventoryItem, editingStagedItem, isConvertMode, itemId, stagingTargetId, ownerUserId]);

  const enforcePlanLimit = isInventoryMode || isConvertMode || isStagingMode;
  const stagedItemCount = useMemo(
    () => (Array.isArray(stagedItems) ? stagedItems.length : 0),
    [stagedItems],
  );
  const totalTrackedCount = items.length + stagedItemCount;
  const baselineTrackedCount = useMemo(() => {
    if (!enforcePlanLimit) return totalTrackedCount;
    let count = totalTrackedCount;
    if (isInventoryMode && editingInventoryItem) {
      count = Math.max(count - 1, 0);
    }
    if ((isStagingMode || isConvertMode) && editingStagedItem) {
      count = Math.max(count - 1, 0);
    }
    return count;
  }, [editingInventoryItem, editingStagedItem, enforcePlanLimit, isConvertMode, isInventoryMode, isStagingMode, totalTrackedCount]);
  const remainingSlots = useMemo(() => {
    if (planItemLimit == null || !enforcePlanLimit) return null;
    return Math.max(planItemLimit - baselineTrackedCount, 0);
  }, [baselineTrackedCount, enforcePlanLimit, planItemLimit]);

  const headerTitle = useMemo(() => {
    if (isInventoryMode) {
      return editingInventoryItem ? 'Edit item' : 'New item';
    }
    if (isStagingMode) {
      return editingStagedItem ? 'Edit staged item' : 'Stage inventory';
    }
    return 'Load staged item';
  }, [editingInventoryItem, editingStagedItem, isInventoryMode, isStagingMode]);

  const showDeleteAction = useMemo(() => {
    if (isInventoryMode) {
      return editingInventoryItem;
    }
    return (isStagingMode || isConvertMode) && Boolean(stagingTargetId);
  }, [editingInventoryItem, isConvertMode, isInventoryMode, isStagingMode, stagingTargetId]);

  const deleteLabel = useMemo(() => {
    if (isInventoryMode) return 'Delete item';
    return 'Remove staged item';
  }, [isInventoryMode]);
  const showPlanNotice = remainingSlots != null
    && enforcePlanLimit
    && (
      (isInventoryMode && !editingInventoryItem)
      || (isStagingMode && !editingStagedItem)
    );

  const handleChange = useCallback((key: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleAddImage = useCallback(async () => {
    if (!userId || !ownerUserId) {
      setFeedback({ type: 'error', message: 'Session owner not available yet.' });
      return;
    }

    if (images.length >= 2) {
      setFeedback({ type: 'info', message: 'You can add up to two photos per item.' });
      return;
    }

    try {
      setImagePickerBusy(true);
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setFeedback({ type: 'error', message: 'Enable photo library access to add item images.' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];
      if (!asset?.uri) {
        setFeedback({ type: 'error', message: 'Unable to use that image. Try a different photo.' });
        return;
      }

      const tempId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setImages((prev) => [...prev, { id: tempId, uri: asset.uri }]);
    } catch (error) {
      console.error('Failed to pick image', error);
      setFeedback({ type: 'error', message: 'Unable to pick an image right now.' });
    } finally {
      setImagePickerBusy(false);
    }
  }, [userId, ownerUserId, images.length]);

  const handleRemoveImage = useCallback((image: ItemImageState) => {
    if (image.uploading) return;
    setImages((prev) => prev.filter((img) => img.id !== image.id));
    if (image.path) {
      const path = image.path;
      setRemovedImagePaths((prev) => [...prev, path]);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId || !ownerUserId) {
      setFeedback({ type: 'error', message: 'Session owner not available yet.' });
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setFeedback({ type: 'error', message: 'Give your item a name.' });
      return;
    }

    const priceValue = Number.parseFloat(form.price.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(priceValue) || priceValue <= 0) {
      setFeedback({ type: 'error', message: 'Enter a valid price.' });
      return;
    }

    const quantityValue = Number.parseInt(form.quantity, 10);
    if (!Number.isFinite(quantityValue) || quantityValue < 0) {
      setFeedback({ type: 'error', message: 'Quantity must be zero or greater.' });
      return;
    }

    const lowStockValue = Number.parseInt(form.lowStock, 10) || 0;

    const effectiveEventId = activeStageEventId ?? stageEventId ?? stagedItem?.eventId ?? null;
    if (!isInventoryMode && !effectiveEventId) {
      setFeedback({ type: 'error', message: 'Pick an event before staging inventory.' });
      return;
    }

    if (isConvertMode && !stagingTargetId) {
      setFeedback({ type: 'error', message: 'Select a staged item to convert.' });
      return;
    }

    const willCreateNew =
      (isInventoryMode && !editingInventoryItem)
      || (isStagingMode && !editingStagedItem)
      || (isConvertMode && Boolean(stagingTargetId));

    if (enforcePlanLimit && planItemLimit != null && willCreateNew && baselineTrackedCount >= planItemLimit) {
      setFeedback({
        type: 'error',
        message: `Your plan allows up to ${planItemLimit} total items across inventory and staging.`,
      });
      return;
    }

    const uploadedDuringSave: string[] = [];
    const uploadResults: Array<{ id: string; path: string; url: string }> = [];

    try {
      setSaving(true);

      const pendingUploads = images.filter((img) => !img.path);
      if (pendingUploads.length) {
        setImages((prev) =>
          prev.map((img) =>
            pendingUploads.some((pending) => pending.id === img.id) ? { ...img, uploading: true } : img,
          ),
        );
      }

      for (const image of pendingUploads) {
        try {
          const { path, url } = await uploadItemImage({ userId: ownerUserId, uri: image.uri });
          uploadedDuringSave.push(path);
          uploadResults.push({ id: image.id, path, url });
          setImages((prev) =>
            prev.map((img) =>
              img.id === image.id ? { ...img, path, uri: url, uploading: false } : img,
            ),
          );
        } catch (uploadError) {
          console.error('Failed to upload item image', uploadError);
          setImages((prev) =>
            prev.map((img) => (img.id === image.id ? { ...img, uploading: false } : img)),
          );
          setFeedback({ type: 'error', message: 'Failed to upload item image. Try again.' });
          if (uploadedDuringSave.length) {
            await Promise.allSettled(uploadedDuringSave.map((path) => removeItemImage(path)));
          }
          return;
        }
      }

      const uploadPathMap = new Map(uploadResults.map((result) => [result.id, result.path]));
      const finalImagePaths = images
        .map((img) => uploadPathMap.get(img.id) ?? img.path)
        .filter((path): path is string => Boolean(path))
        .slice(0, 2);

      const sharedDetails = {
        name: trimmedName,
        sku: form.sku.trim() || null,
        priceCents: Math.round(priceValue * 100),
        quantity: quantityValue,
        lowStockThreshold: Math.max(lowStockValue, 0),
        imagePaths: finalImagePaths,
      };

      if (isInventoryMode) {
        if (editingInventoryItem && itemId) {
          await updateInventoryItem({
            userId: ownerUserId,
            itemId,
            input: { ...sharedDetails, sessionId: null },
          });
          setFeedback({ type: 'success', message: 'Item updated.' });
        } else {
          await createInventoryItem({
            userId: ownerUserId,
            input: { ...sharedDetails, sessionId: null },
          });
          setFeedback({ type: 'success', message: 'Item created.' });
        }
      } else if (isStagingMode) {
        if (!effectiveEventId) {
          setFeedback({ type: 'error', message: 'Pick an event before staging inventory.' });
          return;
        }
        if (editingStagedItem && stagingTargetId) {
          await updateEventStagedInventoryItem({
            userId: ownerUserId,
            stagedId: stagingTargetId,
            input: { ...sharedDetails },
          });
          setFeedback({ type: 'success', message: 'Pre-staged item updated.' });
        } else {
          const created = await createEventStagedInventoryItem({
            userId: ownerUserId,
            eventId: effectiveEventId,
            input: { ...sharedDetails },
          });
          setStagedItem(created);
          setFeedback({ type: 'success', message: 'Inventory staged for this event.' });
        }
      } else if (isConvertMode && stagingTargetId) {
        if (!effectiveEventId) {
          setFeedback({ type: 'error', message: 'This staged item is missing an event link.' });
          return;
        }

        await updateEventStagedInventoryItem({
          userId: ownerUserId,
          stagedId: stagingTargetId,
          input: { ...sharedDetails },
        });

        const createdItem = await createInventoryItem({
          userId: ownerUserId,
          input: { ...sharedDetails, sessionId: effectiveEventId },
        });

        await updateEventStagedInventoryStatus({
          userId: ownerUserId,
          stagedId: stagingTargetId,
          status: 'converted',
          convertedItemId: createdItem.id,
        });

        setFeedback({ type: 'success', message: 'Inventory added from staging.' });
      }

      if (removedImagePaths.length) {
        const uniqueRemovals = Array.from(new Set(removedImagePaths));
        await Promise.allSettled(uniqueRemovals.map((path) => removeItemImage(path)));
        setRemovedImagePaths([]);
      }

      router.back();
    } catch (error) {
      console.error('Failed to save item', error);
      if (uploadedDuringSave.length) {
        await Promise.allSettled(uploadedDuringSave.map((path) => removeItemImage(path)));
      }
      if (removedImagePaths.length) {
        const results = await Promise.allSettled(removedImagePaths.map((path) => getItemImageUrl(path)));
        setImages((prev) => [
          ...prev,
          ...removedImagePaths.map((path, index) => {
            const result = results[index];
            if (result.status === 'fulfilled') {
              return {
                id: path,
                uri: result.value,
                path,
                uploading: false,
              };
            }
            console.warn('Failed to restore item image URL after error', result.reason);
            return {
              id: path,
              uri: '',
              path,
              uploading: false,
            };
          }),
        ]);
        setRemovedImagePaths([]);
      }
      setFeedback({ type: 'error', message: 'Unable to save changes. Try again.' });
    } finally {
      setSaving(false);
    }
  }, [
    userId,
    ownerUserId,
    form,
    activeStageEventId,
    stageEventId,
    stagedItem?.eventId,
    isInventoryMode,
    isStagingMode,
    isConvertMode,
    enforcePlanLimit,
    editingInventoryItem,
    editingStagedItem,
    planItemLimit,
    baselineTrackedCount,
    stagingTargetId,
    itemId,
    images,
    removedImagePaths,
    router,
  ]);

  const handleDelete = useCallback(() => {
    if (!userId || !ownerUserId) return;

    if (isInventoryMode) {
      if (!editingInventoryItem || !itemId) return;

      Alert.alert('Delete item?', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteInventoryItem({ userId: ownerUserId, itemId });
              const removalTargets = Array.from(
                new Set([
                  ...images.map((img) => img.path).filter(Boolean) as string[],
                  ...removedImagePaths,
                ]),
              );
              if (removalTargets.length) {
                await Promise.allSettled(removalTargets.map((path) => removeItemImage(path)));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete item', error);
              setFeedback({ type: 'error', message: 'Unable to delete item.' });
            } finally {
              setDeleting(false);
            }
          },
        },
      ]);
      return;
    }

    if ((isStagingMode || isConvertMode) && stagingTargetId) {
      Alert.alert('Remove staged item?', 'This will clear the pre-staged record.', [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await deleteEventStagedInventoryItem({ userId: ownerUserId, stagedId: stagingTargetId });
              const removalTargets = Array.from(
                new Set([
                  ...images.map((img) => img.path).filter(Boolean) as string[],
                  ...removedImagePaths,
                  ...(stagedItem?.imagePaths ?? []),
                ]),
              );
              if (removalTargets.length) {
                await Promise.allSettled(removalTargets.map((path) => removeItemImage(path)));
              }
              router.back();
            } catch (error) {
              console.error('Failed to delete staged item', error);
              setFeedback({ type: 'error', message: 'Unable to remove staged inventory.' });
            } finally {
              setDeleting(false);
            }
          },
        },
      ]);
    }
  }, [
    userId,
    ownerUserId,
    isInventoryMode,
    editingInventoryItem,
    itemId,
    images,
    removedImagePaths,
    router,
    isStagingMode,
    isConvertMode,
    stagingTargetId,
    stagedItem?.imagePaths,
  ]);

  const formDisabled = loading || saving || deleting;
  const canAddImage = images.length < 2 && !saving && !deleting && !imagePickerBusy;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <KeyboardDismissibleView
        style={styles.flex}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 }]}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <View style={styles.headerRow}>
            <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
              <Feather name="arrow-left" size={20} color={theme.colors.textPrimary} />
            </Pressable>
            <Text style={[styles.title, { color: theme.colors.textPrimary }]}>{headerTitle}</Text>
            <Pressable
              onPress={handleSave}
              disabled={formDisabled}
              style={({ pressed }) => [
                styles.primaryAction,
                {
                  backgroundColor: theme.colors.primary,
                  opacity: pressed || formDisabled ? 0.7 : 1,
                },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={theme.colors.surface} />
              ) : (
                <Text style={[styles.primaryActionText, { color: theme.colors.surface }]}>Save</Text>
              )}
            </Pressable>
          </View>

          {feedback ? <FeedbackBanner feedback={feedback} colors={theme.colors} /> : null}

          {showPlanNotice ? (
            <View
              style={[styles.notice, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}
            >
              <Feather name="info" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.noticeText, { color: theme.colors.textSecondary }]}>You can add {remainingSlots} more item{remainingSlots === 1 ? '' : 's'} across inventory and staging on your plan.</Text>
            </View>
          ) : null}

          {isStagingMode ? (
            <View style={[styles.notice, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Feather name="clock" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.noticeText, { color: theme.colors.textSecondary }]}>
                Staged items stay linked to this event until you load them into live inventory.
              </Text>
            </View>
          ) : null}

          {isConvertMode ? (
            <View style={[styles.notice, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
              <Feather name="truck" size={14} color={theme.colors.textSecondary} />
              <Text style={[styles.noticeText, { color: theme.colors.textSecondary }]}>
                Saving will add this item to live inventory and mark the staged record as loaded.
              </Text>
            </View>
          ) : null}

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>Loading item…</Text>
            </View>
          ) : (
            <View style={styles.form}>
              <FormField
                label="Item name"
                value={form.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder="Coffee mug"
                editable={!formDisabled}
                themeColors={theme.colors}
              />

              <FormField
                label="Price"
                value={form.price}
                onChangeText={(text) => handleChange('price', text)}
                placeholder="$12.00"
                keyboardType="decimal-pad"
                editable={!formDisabled}
                themeColors={theme.colors}
              />

              <FormField
                label="SKU (optional)"
                value={form.sku}
                onChangeText={(text) => handleChange('sku', text)}
                placeholder="SKU-123"
                autoCapitalize="characters"
                editable={!formDisabled}
                themeColors={theme.colors}
              />

              <FormField
                label="Quantity"
                value={form.quantity}
                onChangeText={(text) => handleChange('quantity', text)}
                placeholder="10"
                keyboardType="number-pad"
                editable={!formDisabled}
                themeColors={theme.colors}
              />

              <FormField
                label="Low stock threshold"
                value={form.lowStock}
                onChangeText={(text) => handleChange('lowStock', text)}
                placeholder="3"
                keyboardType="number-pad"
                editable={!formDisabled}
                helper="We'll warn you when quantity drops to or below this number."
                themeColors={theme.colors}
              />

              <View style={[styles.imageSection, { borderColor: theme.colors.border, backgroundColor: theme.colors.surface }]}>
                <View style={styles.imageSectionHeader}>
                  <Text style={[styles.imageSectionTitle, { color: theme.colors.textPrimary }]}>Photos</Text>
                  <Text style={[styles.imageSectionSubtitle, { color: theme.colors.textSecondary }]}>Showcase your item with up to two images.</Text>
                </View>
                <View style={styles.imageGrid}>
                  {images.map((image) => (
                    <View
                      key={image.id}
                      style={[styles.imageTile, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}
                    >
                      <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
                      {!image.path ? (
                        <View style={styles.imageBadge}>
                          <Text style={styles.imageBadgeText}>Uploads on save</Text>
                        </View>
                      ) : null}
                      {image.uploading ? (
                        <View style={styles.imageOverlay}>
                          <ActivityIndicator size="small" color="#FFFFFF" />
                          <Text style={styles.imageOverlayText}>Uploading…</Text>
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => handleRemoveImage(image)}
                        disabled={saving || deleting || image.uploading}
                        style={({ pressed }) => [
                          styles.imageRemoveButton,
                          {
                            opacity: pressed || saving || deleting || image.uploading ? 0.7 : 1,
                          },
                        ]}
                        hitSlop={12}
                      >
                        <Feather name="x" size={14} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  ))}
                  {images.length < 2 ? (
                    <Pressable
                      onPress={handleAddImage}
                      disabled={!canAddImage}
                      style={({ pressed }) => [
                        styles.imageAddTile,
                        {
                          borderColor: theme.colors.primary,
                          backgroundColor: 'rgba(101, 88, 245, 0.08)',
                          opacity: pressed || !canAddImage ? 0.7 : 1,
                        },
                      ]}
                    >
                      {imagePickerBusy ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} />
                      ) : (
                        <>
                          <Feather name="plus" size={20} color={theme.colors.primary} />
                          <Text style={[styles.imageAddText, { color: theme.colors.primary }]}>Add photo</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                </View>
              </View>

              {showDeleteAction ? (
                <Pressable
                  onPress={handleDelete}
                  disabled={deleting}
                  style={({ pressed }) => [
                    styles.deleteButton,
                    {
                      backgroundColor: theme.colors.error,
                      opacity: pressed || deleting ? 0.6 : 1,
                    },
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={theme.colors.surface} />
                  ) : (
                    <Text style={[styles.deleteButtonText, { color: theme.colors.surface }]}>{deleteLabel}</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
          )}
      </KeyboardDismissibleView>
    </SafeAreaView>
  );
}

function FeedbackBanner({
  feedback,
  colors,
}: {
  feedback: FeedbackState;
  colors: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  if (!feedback) return null;

  const palette =
    feedback.type === 'success'
      ? { border: colors.success, background: 'rgba(45, 186, 127, 0.12)', text: colors.success }
      : feedback.type === 'error'
      ? { border: colors.error, background: 'rgba(243, 105, 110, 0.12)', text: colors.error }
      : { border: colors.primary, background: 'rgba(101, 88, 245, 0.12)', text: colors.primary };

  return (
    <View style={[styles.feedbackBanner, { borderColor: palette.border, backgroundColor: palette.background }]}>
      <Text style={[styles.feedbackText, { color: palette.text }]}>{feedback.message}</Text>
    </View>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  helper,
  editable = true,
  keyboardType,
  autoCapitalize,
  themeColors,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  helper?: string;
  editable?: boolean;
  keyboardType?: 'default' | 'number-pad' | 'decimal-pad';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  themeColors: ReturnType<typeof useTheme>['theme']['colors'];
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={themeColors.textMuted}
        editable={editable}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        style={[styles.fieldInput, { borderColor: themeColors.border, color: themeColors.textPrimary }]}
      />
      {helper ? <Text style={[styles.fieldHelper, { color: themeColors.textMuted }]}>{helper}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryAction: {
    minWidth: 80,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
  },
  feedbackBanner: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  feedbackText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeText: {
    fontSize: 13,
    flex: 1,
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 12,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  fieldHelper: {
    fontSize: 12,
    marginTop: 2,
  },
  imageSection: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 16,
  },
  imageSectionHeader: {
    gap: 4,
  },
  imageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  imageSectionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  imageGrid: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  imageTile: {
    width: 140,
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  imagePreview: {
    width: '100%',
    height: '100%',
  },
  imageRemoveButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 10, 15, 0.55)',
  },
  imageBadge: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(9, 10, 15, 0.55)',
  },
  imageBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(9, 10, 15, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  imageOverlayText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  imageAddTile: {
    width: 140,
    height: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  imageAddText: {
    fontSize: 13,
    fontWeight: '600',
  },
  deleteButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
