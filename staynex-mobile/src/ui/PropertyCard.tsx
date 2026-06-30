import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { PropertySummary } from "@staynex/backend/types";
import { color, fontSize, fontWeight, radius, spacing } from "@staynex/shared";
import { PriceTag } from "@/ui/PriceTag";

/** Result card: cover image, name, city, from-price (kobo→NGN). */
export function PropertyCard({
  property,
  onPress,
}: {
  property: PropertySummary;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${property.name}, ${property.cityName}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.imageWrap}>
        {property.coverImageUrl ? (
          <Image
            source={{ uri: property.coverImageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.image, styles.imageFallback]}>
            <Text style={styles.fallbackText}>No photo</Text>
          </View>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {property.name}
        </Text>
        <Text style={styles.city} numberOfLines={1}>
          {property.cityName}
        </Text>
        <View style={styles.footer}>
          <PriceTag kobo={property.fromPriceKobo} suffix="from / night" />
          <Text style={styles.rooms}>
            {property.roomTypeCount} room{property.roomTypeCount === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  imageWrap: { aspectRatio: 16 / 9, backgroundColor: color.subtle },
  image: { width: "100%", height: "100%" },
  imageFallback: { alignItems: "center", justifyContent: "center" },
  fallbackText: { color: color.muted, fontSize: fontSize.sm },
  body: { padding: spacing.lg, gap: spacing.xs },
  name: { fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: color.ink },
  city: { fontSize: fontSize.sm, color: color.muted },
  footer: {
    marginTop: spacing.xs,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  rooms: { fontSize: fontSize.xs, color: color.muted },
});
