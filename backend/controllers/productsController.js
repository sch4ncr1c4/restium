const { pool } = require("../db");

const ALLOWED_PRINTERS = new Set([
  "comanda salon",
  "comanda cocina",
  "comanda barra",
]);
const HAS_OWN = Object.prototype.hasOwnProperty;

function normalizePrinters(printerTargets) {
  if (!Array.isArray(printerTargets)) return [];

  const normalized = printerTargets
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  const unique = [...new Set(normalized)];
  return unique;
}

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "on";
}

function parsePrinterTargets(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const maybeArray = JSON.parse(trimmed);
    if (Array.isArray(maybeArray)) return maybeArray;
  } catch (_error) {
    // Fallback to comma-separated parsing.
  }
  return trimmed.split(",").map((item) => item.trim());
}

function validateProductInput(payload) {
  const {
    name,
    price,
    description = null,
    taxRate = 21,
    rubro = null,
    subrubro = null,
    productType = null,
    printerTargets = [],
    showInMenu = true,
    showInDelivery = true,
    imageUrl = null,
  } = payload || {};

  if (!name || price === undefined) {
    return { ok: false, message: "name and price are required" };
  }

  const numericPrice = Number(price);
  const numericTaxRate = Number(taxRate);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return { ok: false, message: "price must be a number greater than 0" };
  }
  if (!Number.isFinite(numericTaxRate) || numericTaxRate < 0) {
    return { ok: false, message: "taxRate must be a valid non-negative number" };
  }

  const normalizedPrinters = normalizePrinters(parsePrinterTargets(printerTargets));
  const normalizedShowInMenu = parseBoolean(showInMenu, true);
  const normalizedShowInDelivery = parseBoolean(showInDelivery, true);
  if (normalizedPrinters.length < 1) {
    return { ok: false, message: "at least one printer target is required" };
  }
  if (normalizedPrinters.length > 3) {
    return { ok: false, message: "you can select up to 3 printer targets" };
  }

  const invalidPrinter = normalizedPrinters.find((printer) => !ALLOWED_PRINTERS.has(printer));
  if (invalidPrinter) {
    return { ok: false, message: `invalid printer target: ${invalidPrinter}` };
  }

  return {
    ok: true,
    data: {
      name: String(name).trim(),
      price: numericPrice,
      description: description ? String(description).trim() : null,
      taxRate: numericTaxRate,
      rubro: rubro ? String(rubro).trim() : null,
      subrubro: subrubro ? String(subrubro).trim() : null,
      productType: productType ? String(productType).trim() : null,
      printerTargets: normalizedPrinters,
      showInMenu: normalizedShowInMenu,
      showInDelivery: normalizedShowInDelivery,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
    },
  };
}

function toPublicProduct(row) {
  if (!row) return row;

  let imageUrl = row.image_url || null;
  if (row.image_data && row.image_mime_type) {
    const asBuffer = Buffer.isBuffer(row.image_data)
      ? row.image_data
      : Buffer.from(row.image_data);
    imageUrl = `data:${row.image_mime_type};base64,${asBuffer.toString("base64")}`;
  }

  return {
    id: row.id,
    business_id: row.business_id,
    name: row.name,
    description: row.description,
    price: row.price,
    tax_rate: row.tax_rate,
    rubro: row.rubro,
    subrubro: row.subrubro,
    product_type: row.product_type,
    printer_targets: row.printer_targets,
    show_in_menu: row.show_in_menu,
    show_in_delivery: row.show_in_delivery,
    image_url: imageUrl,
  };
}

async function getProducts(req, res) {
  try {
    const result = await pool.query(
      `
        SELECT
          id,
          business_id,
          name,
          description,
          price,
          tax_rate,
          rubro,
          subrubro,
          product_type,
          printer_targets,
          show_in_menu,
          show_in_delivery,
          image_url,
          image_data,
          image_mime_type
        FROM products
        WHERE business_id = $1
        ORDER BY id ASC
      `,
      [req.user.business_id]
    );

    return res.json({
      ok: true,
      data: result.rows.map((row) => toPublicProduct(row)),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not fetch products",
      error: error.message,
    });
  }
}

async function createProduct(req, res) {
  const validation = validateProductInput({
    ...req.body,
    imageUrl: req.body.imageUrl || null,
  });
  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      message: validation.message,
    });
  }

  const {
    name,
    price,
    description,
    taxRate,
    rubro,
    subrubro,
    productType,
    printerTargets,
    showInMenu,
    showInDelivery,
    imageUrl,
  } = validation.data;
  const imageData = req.file?.buffer || null;
  const imageMimeType = req.file?.mimetype || null;
  const imageUrlToStore = imageData ? null : imageUrl;

  try {
    const result = await pool.query(
      `
        INSERT INTO products
        (business_id, name, description, price, tax_rate, rubro, subrubro, product_type, printer_targets, show_in_menu, show_in_delivery, image_url, image_data, image_mime_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, business_id, name, description, price, tax_rate, rubro, subrubro, product_type, printer_targets, show_in_menu, show_in_delivery, image_url, image_data, image_mime_type
      `,
      [
        req.user.business_id,
        name,
        description,
        price,
        taxRate,
        rubro,
        subrubro,
        productType,
        printerTargets,
        showInMenu,
        showInDelivery,
        imageUrlToStore,
        imageData,
        imageMimeType,
      ]
    );

    return res.status(201).json({
      ok: true,
      data: toPublicProduct(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not create product",
      error: error.message,
    });
  }
}

async function updateProduct(req, res) {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid product id",
    });
  }

  let existingProduct = null;
  try {
    const existingResult = await pool.query(
      "SELECT id, image_url, image_data, image_mime_type FROM products WHERE id = $1 AND business_id = $2 LIMIT 1",
      [productId, req.user.business_id]
    );
    if (!existingResult.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "product not found",
      });
    }
    existingProduct = existingResult.rows[0];
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not validate product",
      error: error.message,
    });
  }

  const validation = validateProductInput({
    ...req.body,
    imageUrl: req.body.imageUrl ?? existingProduct.image_url ?? null,
  });
  if (!validation.ok) {
    return res.status(400).json({
      ok: false,
      message: validation.message,
    });
  }

  const {
    name,
    price,
    description,
    taxRate,
    rubro,
    subrubro,
    productType,
    printerTargets,
    showInMenu,
    showInDelivery,
    imageUrl,
  } = validation.data;
  const hasImageUrlInBody = HAS_OWN.call(req.body || {}, "imageUrl");
  let imageData = existingProduct.image_data || null;
  let imageMimeType = existingProduct.image_mime_type || null;
  let imageUrlToStore = existingProduct.image_url || null;

  if (req.file?.buffer) {
    imageData = req.file.buffer;
    imageMimeType = req.file.mimetype || null;
    imageUrlToStore = null;
  } else if (hasImageUrlInBody) {
    imageUrlToStore = imageUrl || null;
    imageData = null;
    imageMimeType = null;
  }

  try {
    const result = await pool.query(
      `
        UPDATE products
        SET
          name = $1,
          description = $2,
          price = $3,
          tax_rate = $4,
          rubro = $5,
          subrubro = $6,
          product_type = $7,
          printer_targets = $8,
          show_in_menu = $9,
          show_in_delivery = $10,
          image_url = $11,
          image_data = $12,
          image_mime_type = $13
        WHERE id = $14
          AND business_id = $15
        RETURNING id, business_id, name, description, price, tax_rate, rubro, subrubro, product_type, printer_targets, show_in_menu, show_in_delivery, image_url, image_data, image_mime_type
      `,
      [
        name,
        description,
        price,
        taxRate,
        rubro,
        subrubro,
        productType,
        printerTargets,
        showInMenu,
        showInDelivery,
        imageUrlToStore,
        imageData,
        imageMimeType,
        productId,
        req.user.business_id,
      ]
    );

    return res.json({
      ok: true,
      data: toPublicProduct(result.rows[0]),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not update product",
      error: error.message,
    });
  }
}

async function deleteProduct(req, res) {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({
      ok: false,
      message: "invalid product id",
    });
  }

  try {
    const result = await pool.query(
      `
        DELETE FROM products
        WHERE id = $1
          AND business_id = $2
        RETURNING id, business_id, name
      `,
      [productId, req.user.business_id]
    );

    if (!result.rowCount) {
      return res.status(404).json({
        ok: false,
        message: "product not found",
      });
    }

    return res.json({
      ok: true,
      data: result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: "could not delete product",
      error: error.message,
    });
  }
}

module.exports = {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
};
