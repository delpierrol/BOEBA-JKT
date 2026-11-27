import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Shield,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "user",
  staff_role: "none",
};

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [deletingUser, setDeletingUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
        setIsAdmin(user?.role === "admin");
      } catch {
        setCurrentUser(null);
        setIsAdmin(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };
    checkAuth();
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["master-users"],
    queryFn: () => base44.users.list(),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.users.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(["master-users"]);
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setFormError("");
    },
    onError: (err) => {
      setFormError(err.message || "Gagal menambahkan user");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.users.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["master-users"]);
      setDialogOpen(false);
      setEditingUser(null);
      setForm(EMPTY_FORM);
      setFormError("");
    },
    onError: (err) => {
      setFormError(err.message || "Gagal mengupdate user");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.users.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["master-users"]);
      setDeletingUser(null);
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setDialogOpen(true);
  };

  const openEditDialog = (user) => {
    setEditingUser(user);
    setForm({
      full_name: user.full_name || "",
      email: user.email || "",
      password: "",
      role: user.role || "user",
      staff_role: user.staff_role || "none",
    });
    setFormError("");
    setDialogOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");

    if (!editingUser) {
      if (!form.email.trim()) {
        setFormError("Email wajib diisi");
        return;
      }
      if (form.password.length < 6) {
        setFormError("Password minimal 6 karakter");
        return;
      }
      createMutation.mutate({
        email: form.email.trim(),
        full_name: form.full_name.trim() || undefined,
        password: form.password,
        role: form.role,
        staff_role: form.staff_role,
      });
    } else {
      if (form.password && form.password.length < 6) {
        setFormError("Password baru minimal 6 karakter");
        return;
      }
      const payload = {
        full_name: form.full_name.trim() || undefined,
        role: form.role,
        staff_role: form.staff_role,
      };
      if (form.password) {
        payload.password = form.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: payload });
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardHeader>
            <CardTitle>Login Diperlukan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">
              Silakan login sebagai Admin untuk mengakses halaman Master Users.
            </p>
            <Button
              onClick={() => base44.auth.redirectToLogin("/UserManagement")}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Akses ditolak. Halaman Master Users hanya dapat diakses oleh Admin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.full_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q) ||
      (u.role || "").toLowerCase().includes(q)
    );
  });

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-teal-600" />
            Master Users
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Kelola akun Admin dan Staff yang dapat mengakses Dashboard, Check-In, dan QR Scanner
          </p>
        </div>

        <Button
          onClick={openCreateDialog}
          className="bg-teal-600 hover:bg-teal-700 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Tambah User
        </Button>
      </div>

      <Card className="border-teal-200/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base font-semibold text-gray-800">
              Daftar User ({filteredUsers.length})
            </CardTitle>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
              <Input
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-500">
              Tidak ada user ditemukan.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Staff Role</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => {
                    const isSelf = u.id === currentUser?.id;
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">
                          {u.full_name || "-"}
                          {isSelf && (
                            <Badge variant="outline" className="ml-2 text-xs text-teal-700 border-teal-300">
                              You
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          {u.role === "admin" ? (
                            <Badge className="bg-teal-100 text-teal-800 border-teal-300 flex w-fit items-center gap-1">
                              <Shield className="w-3 h-3" /> Admin
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Staff</Badge>
                          )}
                        </TableCell>
                        <TableCell className="capitalize">
                          {u.staff_role && u.staff_role !== "none" ? u.staff_role : "-"}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {u.created_date ? format(new Date(u.created_date), "dd MMM yyyy") : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(u)}
                              title="Edit User"
                            >
                              <Pencil className="w-4 h-4 text-gray-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingUser(u)}
                              disabled={isSelf}
                              title={isSelf ? "Tidak dapat menghapus akun sendiri" : "Hapus User"}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-40"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Tambah User Baru"}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="full_name">Nama Lengkap</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Contoh: Melinda Sari"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="staff@boebajkt.com"
                disabled={Boolean(editingUser)}
                required={!editingUser}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">
                {editingUser ? "Password Baru (opsional)" : "Password *"}
              </Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editingUser ? "Kosongkan jika tidak ingin ganti password" : "Minimal 6 karakter"}
                required={!editingUser}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(value) => setForm({ ...form, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="user">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Staff Role</Label>
                <Select
                  value={form.staff_role}
                  onValueChange={(value) => setForm({ ...form, staff_role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="hostess">Hostess</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-600 hover:bg-teal-700 text-white"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Menyimpan...
                  </>
                ) : editingUser ? (
                  "Simpan Perubahan"
                ) : (
                  "Tambah User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={Boolean(deletingUser)} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus User?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun <strong>{deletingUser?.email}</strong> akan dihapus permanen dan tidak bisa lagi login ke sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingUser && deleteMutation.mutate(deletingUser.id)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
