import React, { useEffect, useState } from "react";
import { ApiHelper, UserHelper } from "../../../src/helpers";
import { ErrorHelper } from "../../helpers/ErrorHelper";
import { GatewayData, Permissions, StripePaymentMethod } from "../../../src/interfaces";
import { useIsFocused } from "@react-navigation/native";
import { Alert, View } from "react-native";
import { ActivityIndicator, Button, Card, Divider, IconButton, List, Text, useTheme } from "react-native-paper";
import { useAppTheme } from "../../../src/theme";
import { EnhancedPaymentMethodModal } from "../modals/EnhancedPaymentMethodModal";
import { EnhancedBankForm } from "./EnhancedBankForm";
import { CardForm } from "./CardForm";
import { useTranslation } from "react-i18next";

interface Props {
  customerId: string;
  paymentMethods: StripePaymentMethod[];
  updatedFunction: () => void;
  isLoading: boolean;
  publishKey: string;
  gatewayData?: GatewayData[];
}

export function PaymentMethods({ customerId, paymentMethods, updatedFunction, isLoading, gatewayData }: Props) {
  const { t } = useTranslation();
  const { spacing } = useAppTheme();
  const theme = useTheme();
  const isKingdomFunding = gatewayData?.[0]?.provider?.toLowerCase() === "kingdomfunding";
  const kfTokenizationKey = isKingdomFunding ? gatewayData![0]?.publicKey : "";
  const kfSandbox = isKingdomFunding ? (gatewayData![0]?.settings?.sandbox === true || gatewayData![0]?.environment === "sandbox") : false;
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editPaymentMethod, setEditPaymentMethod] = useState<StripePaymentMethod>(new StripePaymentMethod());
  const [verify, setVerify] = useState<boolean>(false);
  const [mode, setMode] = useState<"display" | "edit">("display");
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) {
      setMode("display");
      setEditPaymentMethod(new StripePaymentMethod());
    }
  }, [isFocused]);

  const handleEdit = (paymentMethod: StripePaymentMethod, verifyAccount?: boolean) => {
    setEditPaymentMethod(paymentMethod);
    setVerify(!!verifyAccount);
    setMode("edit");
  };

  const handleDelete = () => {
    console.log("[PM Delete] editPaymentMethod:", JSON.stringify(editPaymentMethod), "customerId:", customerId);
    if (!editPaymentMethod.id) {
      Alert.alert("Error", "No payment method selected for deletion.");
      return;
    }
    Alert.alert(
      "Delete Payment Method",
      `Are you sure you want to delete ${editPaymentMethod.name || "this"} ending in ${editPaymentMethod.last4 || "****"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const url = "/paymentmethods/" + editPaymentMethod.id + "/" + customerId;
              console.log("[PM Delete] Calling:", url);
              const result = await ApiHelper.delete(url, "GivingApi");
              console.log("[PM Delete] Result:", JSON.stringify(result));
              if (result?.error) {
                Alert.alert("Delete Failed", result.error);
              } else {
                setMode("display");
                await updatedFunction();
              }
            } catch (err: any) {
              console.error("[PM Delete] Error:", err);
              Alert.alert("Delete Failed", err?.message || JSON.stringify(err));
              ErrorHelper.logError("payment-method-delete", err);
            }
          }
        }
      ]
    );
  };

  let editModeContent: any = null;
  switch (editPaymentMethod.type) {
    case "card":
      editModeContent = <CardForm setMode={setMode} card={editPaymentMethod} customerId={customerId} updatedFunction={updatedFunction} handleDelete={handleDelete} isKingdomFunding={isKingdomFunding} kfTokenizationKey={kfTokenizationKey} kfSandbox={kfSandbox} />;
      break;
    case "bank":
      editModeContent = <EnhancedBankForm setMode={setMode} bank={editPaymentMethod} customerId={customerId} updatedFunction={updatedFunction} handleDelete={handleDelete} showVerifyForm={verify} />;
      break;
  }

  const getMethodIcon = (type: string) => (type === "card" ? "credit-card" : "bank");

  const getMethodTitle = (method: StripePaymentMethod) => `${method.name} ending in ${method.last4}`;

  const getMethodDescription = (method: StripePaymentMethod) => {
    if (method.status === "new") return t("donations.verificationRequired");
    return method.type === "card" ? t("donations.creditCard") : t("donations.bankAccount");
  };

  const renderPaymentMethod = ({ item }: { item: StripePaymentMethod }) => (
    <List.Item
      title={getMethodTitle(item)}
      description={getMethodDescription(item)}
      left={() => <List.Icon icon={getMethodIcon(item.type)} />}
      right={() => (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {item?.status === "new" && (
            <Button mode="text" onPress={() => handleEdit(item, true)} style={{ marginRight: spacing.xs }}>
              {t("donations.verify")}
            </Button>
          )}
          {UserHelper.checkAccess(Permissions.givingApi.settings.edit) && <IconButton icon="pencil" size={20} onPress={() => handleEdit(item)} />}
        </View>
      )}
    />
  );

  const content =
    mode === "display" ? (
      <Card style={{ marginBottom: spacing.md }}>
        <Card.Title title={t("donations.paymentMethods")} titleStyle={{ fontSize: 20, fontWeight: "600" }} left={props => <IconButton {...props} icon="credit-card" size={24} iconColor={theme.colors.primary} style={{ margin: 0 }} />} right={props => UserHelper.checkAccess(Permissions.givingApi.settings.edit) && <IconButton {...props} icon="plus" size={24} iconColor={theme.colors.primary} onPress={() => setShowModal(true)} style={{ margin: 0 }} />} />
        <Card.Content>
          {isLoading ? (
            <ActivityIndicator size="large" style={{ margin: spacing.md }} color={theme.colors.primary} />
          ) : paymentMethods.length > 0 ? (
            <>
              {paymentMethods.map((item, index) => (
                <React.Fragment key={item.id}>
                  {renderPaymentMethod({ item })}
                  {index < paymentMethods.length - 1 && <Divider />}
                </React.Fragment>
              ))}
              {UserHelper.checkAccess(Permissions.givingApi.settings.edit) && (
                <>
                  <Divider style={{ marginVertical: spacing.sm }} />
                  <Button mode="outlined" onPress={() => setShowModal(true)} icon="plus" style={{ marginTop: spacing.sm }}>
                    {t("donations.addPaymentMethod")}
                  </Button>
                </>
              )}
            </>
          ) : (
            <View style={{ alignItems: "center", marginVertical: spacing.md }}>
              <Text variant="bodyMedium" style={{ textAlign: "center", marginBottom: spacing.md }}>
                {t("donations.noPaymentMethods")}
              </Text>
              {UserHelper.checkAccess(Permissions.givingApi.settings.edit) && (
                <Button mode="contained" onPress={() => setShowModal(true)} icon="plus">
                  {t("donations.addFirstPaymentMethod")}
                </Button>
              )}
            </View>
          )}
        </Card.Content>
      </Card>
    ) : (
      editModeContent
    );

  return (
    <>
      <EnhancedPaymentMethodModal show={showModal} close={() => setShowModal(false)} onSelect={handleEdit} />
      {content}
    </>
  );
}
